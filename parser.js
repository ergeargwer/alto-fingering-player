/**
 * Client-side MusicXML (minimal subset) + JSON melody parser.
 * Reads: note / pitch / step / alter / octave / duration / voice / rest,
 * divisions, sound@tempo, metronome/per-minute.
 * Multiple parts: listParts + partId.
 */
(function (global) {
  const TYPE_BEATS = {
    maxima: 32, long: 16, breve: 8, whole: 4, half: 2, quarter: 1,
    eighth: 0.5, "16th": 0.25, "32nd": 0.125, "64th": 0.0625, "128th": 0.03125
  };

  function localName(node) {
    if (!node) return "";
    return (node.localName || node.nodeName || "").replace(/^.*:/, "").toLowerCase();
  }

  function allByTag(root, tag) {
    const out = [];
    if (!root) return out;
    const want = String(tag).toLowerCase();
    if (root.getElementsByTagNameNS) {
      const ns = root.getElementsByTagNameNS("*", tag);
      if (ns && ns.length) {
        for (let i = 0; i < ns.length; i++) out.push(ns[i]);
        return out;
      }
    }
    const walk = root.getElementsByTagName ? root.getElementsByTagName("*") : [];
    for (let i = 0; i < walk.length; i++) {
      if (localName(walk[i]) === want) out.push(walk[i]);
    }
    return out;
  }

  function firstByTag(root, tag) {
    return allByTag(root, tag)[0] || null;
  }

  function childrenNamed(el, name) {
    const out = [];
    if (!el) return out;
    for (let i = 0; i < el.children.length; i++) {
      if (localName(el.children[i]) === name) out.push(el.children[i]);
    }
    return out;
  }

  function hasChild(el, name) {
    return childrenNamed(el, name).length > 0;
  }

  function text(el) {
    return el && el.textContent ? el.textContent.trim() : "";
  }

  function childText(el, tag) {
    return text(firstByTag(el, tag));
  }

  function num(el, tag, fallback) {
    const v = parseFloat(tag ? childText(el, tag) : text(el));
    return Number.isFinite(v) ? v : fallback;
  }

  function parsePitch(noteEl) {
    const p = firstByTag(noteEl, "pitch");
    if (!p) return null;
    const step = childText(p, "step").toUpperCase();
    const octave = parseInt(childText(p, "octave"), 10);
    const alterRaw = childText(p, "alter");
    const alter = alterRaw === "" ? 0 : parseFloat(alterRaw) || 0;
    if (!step || !Number.isFinite(octave)) return null;
    const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    if (BASE[step] == null) return null;
    const midi = (octave + 1) * 12 + BASE[step] + Math.round(alter);
    const F = global.Fingerings;
    const name = F ? F.midiToName(midi) : step + octave;
    return { midi: midi, name: name };
  }

  function noteBeats(noteEl, divisions) {
    const durEl = firstByTag(noteEl, "duration");
    const dur = durEl ? parseFloat(text(durEl)) : NaN;
    if (Number.isFinite(dur) && divisions > 0) return dur / divisions;
    const type = childText(noteEl, "type").toLowerCase();
    let beats = TYPE_BEATS[type];
    if (beats == null) beats = 1;
    const dots = childrenNamed(noteEl, "dot").length;
    let extra = 0;
    let add = beats / 2;
    for (let i = 0; i < dots; i++) {
      extra += add;
      add /= 2;
    }
    return beats + extra;
  }

  function extractTempo(root) {
    let bpm = null;
    const sounds = allByTag(root, "sound");
    for (let i = 0; i < sounds.length; i++) {
      const t = parseFloat(sounds[i].getAttribute("tempo"));
      if (Number.isFinite(t) && t > 0) {
        bpm = t;
        break;
      }
    }
    if (bpm) return bpm;
    const per = firstByTag(root, "per-minute");
    if (per) {
      const t = parseFloat(text(per));
      if (Number.isFinite(t) && t > 0) bpm = t;
    }
    return bpm;
  }

  function listParts(doc) {
    const names = {};
    allByTag(doc, "score-part").forEach(function (sp) {
      const id = sp.getAttribute("id");
      if (!id) return;
      names[id] = childText(sp, "part-name") || childText(sp, "instrument-name") || id;
    });
    const seen = {};
    const parts = [];
    function add(id, fallback) {
      if (!id || seen[id]) return;
      seen[id] = true;
      parts.push({ id: id, name: names[id] || fallback || id });
    }
    const rootName = localName(doc.documentElement);
    if (rootName === "score-timewise") {
      const firstMeasure = firstByTag(doc, "measure");
      childrenNamed(firstMeasure, "part").forEach(function (p, i) {
        add(p.getAttribute("id") || ("P" + (i + 1)));
      });
    } else {
      allByTag(doc, "part").forEach(function (p, i) {
        const parent = localName(p.parentNode);
        if (parent !== "score-partwise" && parent !== "score-timewise" && parent !== "#document") {
          if (parent !== "partwise") return;
        }
        add(p.getAttribute("id") || ("P" + (i + 1)));
      });
    }
    if (!parts.length && Object.keys(names).length) {
      Object.keys(names).forEach(function (id) { add(id, names[id]); });
    }
    return parts;
  }

  function measuresForPart(doc, partId) {
    const rootName = localName(doc.documentElement);
    if (rootName === "score-timewise") {
      const out = [];
      allByTag(doc, "measure").forEach(function (m) {
        const kids = childrenNamed(m, "part");
        for (let i = 0; i < kids.length; i++) {
          const id = kids[i].getAttribute("id");
          if (!partId || id === partId || (!id && i === 0)) out.push(kids[i]);
        }
      });
      return out;
    }
    const parts = [];
    allByTag(doc, "part").forEach(function (p) {
      const parent = localName(p.parentNode);
      if (parent === "measure") return;
      parts.push(p);
    });
    if (!parts.length) return [];
    let chosen = parts[0];
    if (partId) {
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].getAttribute("id") === partId) {
          chosen = parts[i];
          break;
        }
      }
    }
    return allByTag(chosen, "measure");
  }

  function parseMeasureNotes(measureEls) {
    let divisions = 1;
    const events = [];
    let cursor = 0;
    let primaryVoice = null;
    let beatsPerBar = 4;
    let beatType = 4;

    function pushNote(noteEl) {
      if (hasChild(noteEl, "grace") || hasChild(noteEl, "cue")) return;
      if (hasChild(noteEl, "chord")) return;
      const voice = childText(noteEl, "voice") || "1";
      if (primaryVoice == null) primaryVoice = voice;
      if (voice !== primaryVoice) return;

      const beats = Math.max(noteBeats(noteEl, divisions), 0.0625);
      const isRest = hasChild(noteEl, "rest");
      const pitch = isRest ? null : parsePitch(noteEl);
      const tieEls = allByTag(noteEl, "tie").concat(allByTag(noteEl, "tied"));
      let tiedStop = false;
      let tiedStart = false;
      tieEls.forEach(function (t) {
        const ty = (t.getAttribute("type") || "").toLowerCase();
        if (ty === "stop") tiedStop = true;
        if (ty === "start") tiedStart = true;
      });

      if (tiedStop && events.length) {
        const prev = events[events.length - 1];
        if (!isRest && pitch && prev.midi === pitch.midi && !prev.rest) {
          prev.dur += beats;
          prev.tieContinue = tiedStart;
          cursor += beats;
          return;
        }
      }

      events.push({
        rest: isRest || !pitch,
        pitch: pitch ? pitch.name : null,
        midi: pitch ? pitch.midi : null,
        dur: beats,
        start: cursor
      });
      cursor += beats;
    }

    for (let mi = 0; mi < measureEls.length; mi++) {
      const measure = measureEls[mi];
      const measureCursorStart = cursor;
      let seenBackup = false;
      const walk = [];
      for (let i = 0; i < measure.children.length; i++) walk.push(measure.children[i]);

      for (let i = 0; i < walk.length; i++) {
        const el = walk[i];
        const name = localName(el);
        if (name === "attributes") {
          const d = num(el, "divisions", NaN);
          if (Number.isFinite(d) && d > 0) divisions = d;
          const t = firstByTag(el, "time");
          if (t) {
            beatsPerBar = num(t, "beats", beatsPerBar);
            beatType = num(t, "beat-type", beatType);
          }
        } else if (name === "backup") {
          seenBackup = true;
          const b = num(el, "duration", 0) / divisions;
          cursor = Math.max(measureCursorStart, cursor - b);
        } else if (name === "forward") {
          const b = num(el, "duration", 0) / divisions;
          cursor += b;
        } else if (name === "note") {
          const v = childText(el, "voice");
          if (seenBackup && primaryVoice && v && v !== primaryVoice) continue;
          if (seenBackup && !v) continue;
          pushNote(el);
        }
      }
    }

    return { events: events, beatsPerBar: beatsPerBar, beatType: beatType };
  }

  function parseXmlDoc(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    const err = firstByTag(doc, "parsererror");
    if (err) throw new Error("XML 語法無效");
    const rootName = localName(doc.documentElement);
    if (rootName !== "score-partwise" && rootName !== "score-timewise") {
      if (!firstByTag(doc, "measure") || !firstByTag(doc, "note")) {
        throw new Error("不是 MusicXML 樂譜");
      }
    }
    return doc;
  }

  function roundDur(d) {
    return Math.round(d * 1000) / 1000;
  }

  function parseMusicXML(xmlString, opts) {
    opts = opts || {};
    const doc = parseXmlDoc(xmlString);
    const title =
      childText(doc, "work-title") ||
      childText(doc, "movement-title") ||
      text(firstByTag(doc, "credit-words")) ||
      "匯入曲";

    const bpm = extractTempo(doc);
    const parts = listParts(doc);
    let partId = opts.partId;
    if (!partId && parts.length) partId = parts[0].id;

    const measureEls = measuresForPart(doc, partId);
    if (!measureEls.length) throw new Error("沒有小節");

    const parsed = parseMeasureNotes(measureEls);
    if (!parsed.events.length) throw new Error("找不到旋律音符");

    const partMeta = parts.filter(function (p) { return p.id === partId; })[0];

    return {
      title: title,
      bpm: bpm,
      beatsPerBar: parsed.beatsPerBar,
      beatType: parsed.beatType,
      notes: parsed.events.map(function (e) {
        return {
          pitch: e.rest ? null : e.pitch,
          midi: e.rest ? null : e.midi,
          dur: roundDur(e.dur),
          rest: !!e.rest
        };
      }),
      source: "musicxml",
      parts: parts,
      partId: partId,
      partName: partMeta ? partMeta.name : partId,
      rawXml: xmlString
    };
  }

  function parseJSONSong(obj) {
    if (typeof obj === "string") obj = JSON.parse(obj);
    if (Array.isArray(obj)) obj = { notes: obj };
    if (!obj || !Array.isArray(obj.notes)) {
      throw new Error("JSON 需要 notes 陣列");
    }
    const notes = obj.notes.map(function (n, i) {
      if (typeof n === "string") return { pitch: n, dur: 1, rest: false };
      const dur = n.dur != null ? n.dur : n.beats != null ? n.beats : n.duration != null ? n.duration : 1;
      const rest = !!(n.rest || n.pitch === "rest" || n.pitch === "REST" || n.type === "rest");
      const pitch = rest ? null : (n.pitch || n.note || n.name);
      if (!rest && !pitch && n.midi == null) {
        throw new Error("第 " + (i + 1) + " 個音沒有 pitch");
      }
      const midi = n.midi != null ? n.midi : (pitch && global.Fingerings ? global.Fingerings.nameToMidi(String(pitch)) : null);
      return {
        pitch: rest ? null : (pitch || (midi != null && global.Fingerings ? global.Fingerings.midiToName(midi) : null)),
        midi: rest ? null : midi,
        dur: roundDur(Number(dur) || 1),
        rest: rest
      };
    });
    if (!notes.length) throw new Error("notes 是空的");
    return {
      title: obj.title || obj.name || "JSON 曲",
      bpm: obj.bpm || obj.tempo || null,
      beatsPerBar: obj.beatsPerBar || (obj.timeSignature && obj.timeSignature[0]) || 4,
      beatType: obj.beatType || (obj.timeSignature && obj.timeSignature[1]) || 4,
      notes: notes,
      source: "json",
      parts: [],
      partId: null
    };
  }

  function parseFileText(text, filename, opts) {
    const name = (filename || "").toLowerCase();
    const trimmed = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!trimmed) throw new Error("檔案是空的");
    const looksJSON = name.endsWith(".json") || trimmed[0] === "{" || trimmed[0] === "[";
    if (looksJSON && !name.endsWith(".xml") && !name.endsWith(".musicxml")) {
      try {
        return parseJSONSong(trimmed);
      } catch (e) {
        if (name.endsWith(".json")) throw e;
      }
    }
    return parseMusicXML(trimmed, opts);
  }

  global.SongParser = {
    parseMusicXML: parseMusicXML,
    parseJSONSong: parseJSONSong,
    parseFileText: parseFileText,
    listParts: listParts
  };
})(window);
