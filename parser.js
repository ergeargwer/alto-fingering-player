/**
 * Client-side MusicXML (minimal subset) + compressed .mxl (ZIP) + JSON melody parser.
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
    if (looksJSON && !name.endsWith(".xml") && !name.endsWith(".musicxml") && !name.endsWith(".mxl")) {
      try {
        return parseJSONSong(trimmed);
      } catch (e) {
        if (name.endsWith(".json")) throw e;
      }
    }
    return parseMusicXML(trimmed, opts);
  }

  function asBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView && ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new Error("需要檔案內容");
  }

  function isZip(bytes) {
    return !!(bytes && bytes.length >= 4 &&
      bytes[0] === 0x50 && bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07 || bytes[2] === 0x08));
  }

  function readZipName(bytes, start, len, utf8) {
    const slice = bytes.subarray(start, start + len);
    if (utf8) return new TextDecoder("utf-8").decode(slice);
    let s = "";
    for (let i = 0; i < slice.length; i++) s += String.fromCharCode(slice[i]);
    return s;
  }

  function listZipEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    const min = Math.max(0, bytes.length - 22 - 65535);
    for (let i = bytes.length - 22; i >= min; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("不是有效的 .mxl／ZIP");
    const entriesCount = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    if (!entriesCount) throw new Error("壓縮檔是空的");
    if (cdOffset >= bytes.length) throw new Error("壓縮檔目錄損壞");
    const entries = [];
    let off = cdOffset;
    for (let n = 0; n < entriesCount; n++) {
      if (off + 46 > bytes.length || view.getUint32(off, true) !== 0x02014b50) {
        throw new Error("壓縮檔目錄損壞");
      }
      const flag = view.getUint16(off + 8, true);
      const method = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const uncompSize = view.getUint32(off + 24, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      if (compSize === 0xffffffff || uncompSize === 0xffffffff) {
        throw new Error("不支援 ZIP64，請改用 .musicxml");
      }
      const name = readZipName(bytes, off + 46, nameLen, !!(flag & 0x800));
      entries.push({
        name: name,
        method: method,
        compSize: compSize,
        uncompSize: uncompSize,
        localOff: localOff,
        flag: flag
      });
      off += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("此瀏覽器無法解開 .mxl，請改匯出 .musicxml");
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function readZipFile(bytes, entry) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const off = entry.localOff;
    if (off + 30 > bytes.length || view.getUint32(off, true) !== 0x04034b50) {
      throw new Error("壓縮檔項目損壞：" + entry.name);
    }
    const nameLen = view.getUint16(off + 26, true);
    const extraLen = view.getUint16(off + 28, true);
    const dataOff = off + 30 + nameLen + extraLen;
    const method = view.getUint16(off + 8, true);
    const size = entry.compSize;
    if (dataOff + size > bytes.length) throw new Error("壓縮檔項目不完整：" + entry.name);
    const payload = bytes.subarray(dataOff, dataOff + size);
    if (method === 0) return payload;
    if (method === 8) return inflateRaw(payload);
    throw new Error("不支援的壓縮方式，請改用 .musicxml");
  }

  function decodeUtf8(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  function pickScoreEntry(files) {
    const names = Object.keys(files);
    function findName(pred) {
      for (let i = 0; i < names.length; i++) {
        if (pred(names[i], names[i].replace(/\\/g, "/").toLowerCase())) return files[names[i]];
      }
      return null;
    }
    return findName(function (orig, lower) {
      if (lower === "meta-inf/container.xml") return false;
      return lower.endsWith(".musicxml") || lower.endsWith(".xml");
    });
  }

  async function unzipMusicXml(bytes) {
    const entries = listZipEntries(bytes);
    const files = {};
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.name || /\/$/.test(e.name)) continue;
      files[e.name.replace(/\\/g, "/")] = e;
    }
    let target = null;
    const container = files["META-INF/container.xml"] || files["meta-inf/container.xml"];
    if (container) {
      const xml = decodeUtf8(await readZipFile(bytes, container));
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const rootfiles = doc.getElementsByTagName("rootfile");
      for (let i = 0; i < rootfiles.length; i++) {
        const path = (rootfiles[i].getAttribute("full-path") || "").replace(/\\/g, "/");
        if (path && files[path]) {
          target = files[path];
          break;
        }
      }
    }
    if (!target) target = pickScoreEntry(files);
    if (!target) throw new Error("壓縮檔裡找不到 MusicXML");
    return decodeUtf8(await readZipFile(bytes, target)).replace(/^\uFEFF/, "");
  }

  async function parseFile(input, filename, opts) {
    if (typeof input === "string") return parseFileText(input, filename, opts);
    const bytes = asBytes(input);
    if (isZip(bytes)) {
      const xml = await unzipMusicXml(bytes);
      const song = parseMusicXML(xml, opts);
      song.source = "mxl";
      return song;
    }
    const text = new TextDecoder("utf-8").decode(bytes);
    return parseFileText(text, filename, opts);
  }

  global.SongParser = {
    parseMusicXML: parseMusicXML,
    parseJSONSong: parseJSONSong,
    parseFileText: parseFileText,
    parseFile: parseFile,
    unzipMusicXml: unzipMusicXml,
    isZip: isZip,
    listParts: listParts
  };
})(window);
