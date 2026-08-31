/**
 * Alto / tenor / soprano written-pitch fingerings (same written keys).
 *
 * Source (beginner “basic” chart, applied consistently Bb3–F6):
 *   Woodwind Fingering Guide — Basic Saxophone Chart
 *   https://www.wfg.woodwind.org/sax/sax_bas_1.html  (A3–C#5)
 *   https://www.wfg.woodwind.org/sax/sax_bas_2.html  (D5–F6)
 * Cross-checked against Tunable’s alto written chart.
 *
 * Documented choices (one chart, no mixing):
 *   - Octave key OFF through C#5; ON from D5 upward.
 *   - F# uses the fork fingering: L1 L2 L3 + R2  (not the aux F# sliver).
 *   - Bb uses WFG *basic* side Bb: L1 L2 + 側B♭（Bis 為備用，測驗頁會標出）.
 *   - Middle C (C5) is L2 only — NOT all six keys.
 *   - Low C / B / Bb / C# use the right-pinky low C spatula plus left-pinky keys.
 *   - Palm keys for D6, Eb6, E6 (add side E), F6 (add palm F + side E).
 *   - F#6 (not on the WFG basic chart): modern high F# key
 *     = octave + palm D + palm Eb + palm F + high F#.
 *
 * Range: written Bb3 (MIDI 58) … F#6 (MIDI 90).
 *
 * Standard written fingerings used here:
 *   G4  → L1 L2 L3, no octave
 *   A4  → L1 L2, no octave
 *   Bb4 → L1 L2 + side Bb（基本）; 備用 Bis = L1 + Bis
 *   C5  → L2 only
 *   D5  → octave + L123 R123
 */
(function (global) {
  const MIDI_MIN = 58; // Bb3
  const MIDI_MAX = 90; // F#6
  const ALTO_TRANSPOSE = 9; // written = concert + major 6th

  const CANON = [
    "C", "C#", "D", "Eb", "E", "F",
    "F#", "G", "G#", "A", "Bb", "B"
  ];

  const ENHARMONIC = {
    "C#": "Db", Db: "C#",
    "D#": "Eb", Eb: "D#",
    "F#": "Gb", Gb: "F#",
    "G#": "Ab", Ab: "G#",
    "A#": "Bb", Bb: "A#",
    E: "Fb", Fb: "E",
    B: "Cb", Cb: "B",
    "B#": "C", "E#": "F",
    "C##": "D", "F##": "G"
  };

  function midiToName(midi) {
    const m = Math.round(midi);
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    return CANON[pc] + oct;
  }

  function nameToMidi(name) {
    if (!name || typeof name !== "string") return null;
    const raw = name.trim().replace("♯", "#").replace("♭", "b").replace("♮", "");
    const m = raw.match(/^([A-Ga-g])([#b]{0,2})(-?\d)$/);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    let acc = m[2].replace(/b/g, "b");
    const oct = parseInt(m[3], 10);
    const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let pc = BASE[letter];
    if (pc == null) return null;
    for (const ch of acc) {
      if (ch === "#") pc += 1;
      else if (ch === "b") pc -= 1;
    }
    return (oct + 1) * 12 + pc;
  }

  function prettyName(name) {
    if (!name) return "";
    return name.replace(/bb/g, "𝄫").replace(/#/g, "♯").replace(/b/g, "♭");
  }

  const CONCERT_CANON = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  function concertName(midi) {
    const m = Math.round(midi);
    const pc = ((m % 12) + 12) % 12;
    const oct = Math.floor(m / 12) - 1;
    return prettyName(CONCERT_CANON[pc] + oct);
  }

  function k(list) {
    return list.slice();
  }

  const L123 = ["L1", "L2", "L3"];
  const R123 = ["R1", "R2", "R3"];
  const ALL6 = L123.concat(R123);

  function oct(list) {
    return ["octave"].concat(list);
  }

  /**
   * Chromatic map, written pitch. Keys match data-key on the SVG.
   * Key ids: octave, frontF, L1, L2, L3, Bis, Gs,
   *          palmD, palmEb, palmF, highFs,
   *          R1, R2, R3, Fs, sideBb, sideC, sideE,
   *          lowCs, lowB, lowBb, lowEb, lowC
   */
  const BY_MIDI = {};

  function set(midi, keys, extra) {
    BY_MIDI[midi] = Object.assign({ midi: midi, name: midiToName(midi), keys: keys }, extra || {});
  }

  // —— First octave (no octave key) ——
  set(58, k(ALL6.concat(["lowBb", "lowC"])));             // Bb3  low Bb
  set(59, k(ALL6.concat(["lowB", "lowC"])));              // B3   low B
  set(60, k(ALL6.concat(["lowC"])));                      // C4   low C
  set(61, k(ALL6.concat(["lowCs", "lowC"])));             // C#4  low C#
  set(62, k(ALL6));                                       // D4
  set(63, k(ALL6.concat(["lowEb"])));                     // Eb4
  set(64, k(L123.concat(["R1", "R2"])));                  // E4
  set(65, k(L123.concat(["R1"])));                        // F4
  set(66, k(L123.concat(["R2"])));                        // F#4  fork
  set(67, k(L123));                                       // G4
  set(68, k(L123.concat(["Gs"])));                        // G#4
  set(69, k(["L1", "L2"]));                               // A4
  set(70, k(["L1", "L2", "sideBb"]), { alt: k(["L1", "Bis"]), altLabel: "Bis B♭" }); // Bb4 WFG basic = 側B♭
  set(71, k(["L1"]));                                     // B4
  set(72, k(["L2"]));                                     // C5   middle C
  set(73, k([]));                                         // C#5  open

  // —— Second octave (octave key) ——
  set(74, oct(ALL6));                                     // D5
  set(75, oct(ALL6.concat(["lowEb"])));                   // Eb5
  set(76, oct(L123.concat(["R1", "R2"])));                // E5
  set(77, oct(L123.concat(["R1"])));                      // F5
  set(78, oct(L123.concat(["R2"])));                      // F#5  fork
  set(79, oct(L123));                                     // G5
  set(80, oct(L123.concat(["Gs"])));                      // G#5
  set(81, oct(["L1", "L2"]));                             // A5
  set(82, oct(["L1", "L2", "sideBb"]), { alt: oct(["L1", "Bis"]), altLabel: "Bis B♭" }); // Bb5
  set(83, oct(["L1"]));                                   // B5
  set(84, oct(["L2"]));                                   // C6
  set(85, oct([]));                                       // C#6  octave only
  set(86, oct(["palmD"]));                                // D6   palm D
  set(87, oct(["palmD", "palmEb"]));                      // Eb6
  set(88, oct(["palmD", "palmEb", "sideE"]));             // E6
  set(89, oct(["palmD", "palmEb", "palmF", "sideE"]));    // F6
  set(90, oct(["palmD", "palmEb", "palmF", "highFs"]));   // F#6  high F# key

  const KEY_INFO = {
    octave: { label: "Oct", group: "thumb", zh: "八度鍵", hint: "左手拇指" },
    frontF: { label: "f", group: "left", zh: "前F", hint: "高音備用" },
    L1: { label: "L1", group: "left", zh: "左1", hint: "左手食指 · B鍵" },
    Bis: { label: "Bis", group: "left", zh: "Bis B♭", hint: "左1旁小鍵" },
    L2: { label: "L2", group: "left", zh: "左2", hint: "左手中指 · A/C鍵" },
    L3: { label: "L3", group: "left", zh: "左3", hint: "左手無名指 · G鍵" },
    Gs: { label: "G#", group: "lpinky", zh: "G♯鍵", hint: "左手小指" },
    lowCs: { label: "C#", group: "lpinky", zh: "低C♯", hint: "左手小指" },
    lowB: { label: "B", group: "lpinky", zh: "低B", hint: "左手小指" },
    lowBb: { label: "Bb", group: "lpinky", zh: "低B♭", hint: "左手小指" },
    palmD: { label: "D", group: "palm", zh: "掌鍵 D", hint: "左手掌 · 高D" },
    palmEb: { label: "Eb", group: "palm", zh: "掌鍵 E♭", hint: "左手掌 · 高E♭" },
    palmF: { label: "F", group: "palm", zh: "掌鍵 F", hint: "左手掌 · 高F" },
    highFs: { label: "F#", group: "palm", zh: "高F♯鍵", hint: "現代樂器高F♯" },
    R1: { label: "R1", group: "right", zh: "右1", hint: "右手食指 · F鍵" },
    R2: { label: "R2", group: "right", zh: "右2", hint: "右手中指 · E鍵" },
    R3: { label: "R3", group: "right", zh: "右3", hint: "右手無名指 · D鍵" },
    Fs: { label: "F#", group: "right", zh: "輔助F♯", hint: "右1、右2之間" },
    sideBb: { label: "Bb", group: "side", zh: "側B♭", hint: "右手側鍵 · 基本B♭" },
    sideC: { label: "C", group: "side", zh: "側C", hint: "右手側鍵" },
    sideE: { label: "E", group: "side", zh: "側E", hint: "右手側鍵 · 高E/F" },
    lowEb: { label: "Eb", group: "rpinky", zh: "E♭鍵", hint: "右手小指 · 上匙" },
    lowC: { label: "C", group: "rpinky", zh: "低C", hint: "右手小指 · 下匙" }
  };

  function keyFullName(id) {
    const info = KEY_INFO[id];
    if (!info) return id;
    return info.zh + "（" + info.label + "）" + (info.hint ? " · " + info.hint : "");
  }

  function keysPhrase(ids) {
    if (!ids || !ids.length) return "不按鍵（開管）";
    return ids.map(function (id) {
      return (KEY_INFO[id] && KEY_INFO[id].zh) || id;
    }).join("、");
  }

  function lookupWritten(midiOrName) {
    let midi = typeof midiOrName === "number" ? midiOrName : nameToMidi(midiOrName);
    if (midi == null || Number.isNaN(midi)) return null;
    midi = Math.round(midi);
    if (midi < MIDI_MIN || midi > MIDI_MAX) {
      return { midi: midi, name: midiToName(midi), keys: [], outOfRange: true };
    }
    return BY_MIDI[midi] || { midi: midi, name: midiToName(midi), keys: [], outOfRange: true };
  }

  function concertToWritten(concertMidi) {
    return concertMidi + ALTO_TRANSPOSE;
  }

  function writtenToConcert(writtenMidi) {
    return writtenMidi - ALTO_TRANSPOSE;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ── Original saxophone key diagram (not copied from any app) ── */

  const VB = { w: 400, h: 740 };

  function svgEl(name, attrs, children) {
    const ns = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(ns, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] == null || attrs[k] === false) return;
        el.setAttribute(k, String(attrs[k]));
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }

  function keyAria(id) {
    return keyFullName(id);
  }

  function keyCircle(id, cx, cy, r, label, labelDy) {
    const g = svgEl("g", { class: "key-wrap", "data-wrap": id });
    g.appendChild(svgEl("circle", {
      class: "key",
      "data-key": id,
      cx: cx, cy: cy, r: r,
      "aria-label": keyAria(id)
    }));
    g.appendChild(svgEl("circle", { class: "pearl-shine", cx: cx - r * 0.28, cy: cy - r * 0.3, r: r * 0.22 }));
    g.appendChild(svgEl("text", {
      class: "key-label",
      x: cx, y: cy + (labelDy != null ? labelDy : 5)
    }, [label]));
    return g;
  }

  function keyOval(id, cx, cy, rx, ry, label) {
    const g = svgEl("g", { class: "key-wrap", "data-wrap": id });
    g.appendChild(svgEl("ellipse", {
      class: "key",
      "data-key": id,
      cx: cx, cy: cy, rx: rx, ry: ry,
      "aria-label": keyAria(id)
    }));
    g.appendChild(svgEl("text", { class: "key-label", x: cx, y: cy + 4 }, [label]));
    return g;
  }

  function keyPad(id, x, y, w, h, rx, label) {
    const g = svgEl("g", { class: "key-wrap", "data-wrap": id });
    g.appendChild(svgEl("rect", {
      class: "key",
      "data-key": id,
      x: x, y: y, width: w, height: h, rx: rx, ry: rx,
      "aria-label": keyAria(id)
    }));
    g.appendChild(svgEl("text", {
      class: "key-label",
      x: x + w / 2, y: y + h / 2 + 4
    }, [label]));
    return g;
  }

  function renderSax(mount) {
    mount.innerHTML = "";
    const svg = svgEl("svg", {
      class: "sax-svg",
      viewBox: "0 0 " + VB.w + " " + VB.h,
      role: "img",
      "aria-label": "Alto saxophone fingering diagram"
    });

    const defs = svgEl("defs", {}, [
      svgEl("linearGradient", { id: "bodyMetal", x1: "0", y1: "0", x2: "1", y2: "0" }, [
        svgEl("stop", { offset: "0%", "stop-color": "#1a140e" }),
        svgEl("stop", { offset: "38%", "stop-color": "#7a5a28" }),
        svgEl("stop", { offset: "50%", "stop-color": "#e0c078" }),
        svgEl("stop", { offset: "62%", "stop-color": "#7a5a28" }),
        svgEl("stop", { offset: "100%", "stop-color": "#1a140e" })
      ]),
      svgEl("linearGradient", { id: "bellInner", x1: "0", y1: "0", x2: "0", y2: "1" }, [
        svgEl("stop", { offset: "0%", "stop-color": "#2a1c10" }),
        svgEl("stop", { offset: "100%", "stop-color": "#0a0704" })
      ]),
      svgEl("linearGradient", { id: "neckMetal", x1: "0", y1: "0", x2: "1", y2: "1" }, [
        svgEl("stop", { offset: "0%", "stop-color": "#c4a056" }),
        svgEl("stop", { offset: "100%", "stop-color": "#4a3518" })
      ]),
      svgEl("filter", { id: "keyGlow", x: "-40%", y: "-40%", width: "180%", height: "180%" }, [
        svgEl("feGaussianBlur", { stdDeviation: "3.5", result: "b" }),
        svgEl("feMerge", {}, [
          svgEl("feMergeNode", { in: "b" }),
          svgEl("feMergeNode", { in: "SourceGraphic" })
        ])
      ])
    ]);
    svg.appendChild(defs);

    const body = svgEl("g", { class: "sax-body", "pointer-events": "none" });

    body.appendChild(svgEl("path", {
      class: "sax-bell",
      d: "M152 575 C 148 620, 80 655, 58 708 L342 708 C 320 655, 252 620, 248 575 Z",
      fill: "url(#bodyMetal)",
      stroke: "#3a2a14",
      "stroke-width": "2"
    }));
    body.appendChild(svgEl("ellipse", {
      cx: "200", cy: "706", rx: "138", ry: "16",
      fill: "url(#bellInner)", stroke: "#2a1c0c", "stroke-width": "2"
    }));
    body.appendChild(svgEl("ellipse", {
      cx: "200", cy: "700", rx: "66", ry: "7",
      fill: "#120c08", opacity: "0.85"
    }));

    body.appendChild(svgEl("rect", {
      x: "152", y: "110", width: "96", height: "475", rx: "48",
      fill: "url(#bodyMetal)", stroke: "#3a2a14", "stroke-width": "2"
    }));

    body.appendChild(svgEl("path", {
      d: "M186 22 C186 10, 214 10, 214 22 L214 58 C214 66, 186 66, 186 58 Z",
      fill: "#2a241c", stroke: "#6a5a40", "stroke-width": "1.5"
    }));
    body.appendChild(svgEl("rect", {
      x: "188", y: "56", width: "24", height: "18", rx: "3",
      fill: "#4a3a22", stroke: "#8a7040"
    }));
    body.appendChild(svgEl("path", {
      d: "M200 74 C 232 78, 258 108, 248 148 C 244 162, 228 168, 214 168 L214 118 C 226 122, 228 132, 220 140 C 210 128, 200 110, 200 74 Z",
      fill: "url(#neckMetal)", stroke: "#3a2a14", "stroke-width": "2"
    }));
    body.appendChild(svgEl("path", {
      d: "M186 74 C 168 90, 162 112, 168 130 C 172 142, 184 150, 186 168 L186 118 C 176 128, 176 138, 182 142 C 186 128, 186 100, 186 74 Z",
      fill: "url(#neckMetal)", stroke: "#3a2a14", "stroke-width": "1.5", opacity: "0.9"
    }));

    body.appendChild(svgEl("line", {
      x1: "168", y1: "348", x2: "232", y2: "348",
      stroke: "#2a2218", "stroke-width": "3", "stroke-linecap": "round"
    }));

    svg.appendChild(body);

    const keys = svgEl("g", { class: "sax-keys" });

    keys.appendChild(svgEl("text", { class: "region-label", x: "300", y: "72" }, ["掌鍵 Palm"]));
    keys.appendChild(keyCircle("palmD", 286, 96, 14, "D"));
    keys.appendChild(keyCircle("palmEb", 314, 122, 12, "E♭"));
    keys.appendChild(keyCircle("palmF", 278, 130, 12, "F"));
    keys.appendChild(keyCircle("highFs", 320, 150, 10, "F♯"));

    keys.appendChild(keyOval("octave", 96, 164, 32, 17, "Oct"));
    keys.appendChild(svgEl("text", { class: "region-label", x: "96", y: "192" }, ["八度"]));

    keys.appendChild(keyCircle("frontF", 164, 180, 9, "f"));

    keys.appendChild(keyCircle("L1", 200, 208, 24, "L1"));
    keys.appendChild(keyCircle("Bis", 230, 240, 10, "Bis"));
    keys.appendChild(keyCircle("L2", 200, 270, 24, "L2"));
    keys.appendChild(keyCircle("L3", 200, 332, 24, "L3"));

    keys.appendChild(svgEl("path", {
      d: "M252 288 h80 a10 10 0 0 1 10 10 v78 a10 10 0 0 1 -10 10 h-56 a10 10 0 0 1 -10 -10 v-88 z",
      class: "pinky-plate",
      fill: "#1a1612",
      stroke: "#4a3a28",
      "stroke-width": "1.2",
      opacity: "0.9"
    }));
    keys.appendChild(keyPad("Gs", 258, 292, 36, 22, 8, "G♯"));
    keys.appendChild(keyPad("lowCs", 258, 320, 36, 24, 8, "C♯"));
    keys.appendChild(keyPad("lowB", 300, 320, 32, 24, 8, "B"));
    keys.appendChild(keyPad("lowBb", 278, 350, 54, 22, 8, "B♭"));
    keys.appendChild(svgEl("text", { class: "region-label", x: "302", y: "388" }, ["左小指"]));

    keys.appendChild(keyCircle("R1", 200, 404, 24, "R1"));
    keys.appendChild(keyCircle("Fs", 238, 438, 9, "F♯"));
    keys.appendChild(keyCircle("R2", 200, 466, 24, "R2"));
    keys.appendChild(keyCircle("R3", 200, 528, 24, "R3"));

    keys.appendChild(keyPad("sideBb", 268, 392, 44, 22, 9, "B♭"));
    keys.appendChild(keyPad("sideC", 268, 418, 44, 22, 9, "C"));
    keys.appendChild(keyPad("sideE", 268, 444, 44, 22, 9, "E"));
    keys.appendChild(svgEl("text", { class: "region-label", x: "290", y: "482" }, ["側鍵"]));

    keys.appendChild(svgEl("path", {
      d: "M248 555 h64 a10 10 0 0 1 10 10 v54 a10 10 0 0 1 -10 10 h-64 a10 10 0 0 1 -10 -10 v-54 a10 10 0 0 1 10 -10 z",
      class: "pinky-plate",
      fill: "#1a1612",
      stroke: "#4a3a28",
      "stroke-width": "1.2"
    }));
    keys.appendChild(keyPad("lowEb", 254, 560, 58, 26, 8, "E♭"));
    keys.appendChild(keyPad("lowC", 254, 592, 58, 26, 8, "C"));
    keys.appendChild(svgEl("text", { class: "region-label", x: "283", y: "636" }, ["右小指"]));

    svg.appendChild(keys);

    const caption = svgEl("text", {
      class: "sax-caption",
      x: "200", y: "728"
    }, ["Alto Sax · 記譜音高 Written"]);
    svg.appendChild(caption);

    mount.appendChild(svg);
    return svg;
  }

  function bindKeyTips(mount, tipEl) {
    if (!mount || !tipEl) return;
    let hideTimer = 0;
    function place(ev) {
      const x = ev.clientX != null ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
      const y = ev.clientY != null ? ev.clientY : (ev.touches && ev.touches[0] && ev.touches[0].clientY);
      if (x == null) return;
      tipEl.style.left = x + "px";
      tipEl.style.top = Math.max(12, y - 8) + "px";
    }
    function showFor(target, ev) {
      const keyEl = target && target.closest ? target.closest("[data-key]") : null;
      if (!keyEl) return false;
      const id = keyEl.getAttribute("data-key");
      tipEl.textContent = keyFullName(id);
      tipEl.classList.add("show");
      place(ev);
      return true;
    }
    function hide() {
      tipEl.classList.remove("show");
    }
    mount.addEventListener("pointerover", function (ev) {
      if (showFor(ev.target, ev)) {
        clearTimeout(hideTimer);
      }
    });
    mount.addEventListener("pointermove", function (ev) {
      if (tipEl.classList.contains("show")) place(ev);
    });
    mount.addEventListener("pointerout", function (ev) {
      const to = ev.relatedTarget;
      if (to && mount.contains(to) && to.closest && to.closest("[data-key]")) return;
      hideTimer = setTimeout(hide, 80);
    });
    mount.addEventListener("pointerdown", function (ev) {
      if (showFor(ev.target, ev)) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 2200);
      }
    });
  }

  function setKeys(mount, pressed, ghost) {
    const on = {};
    const gh = {};
    (pressed || []).forEach(function (id) { on[id] = true; });
    (ghost || []).forEach(function (id) { gh[id] = true; });
    mount.querySelectorAll("[data-key]").forEach(function (el) {
      const id = el.getAttribute("data-key");
      el.classList.toggle("on", !!on[id]);
      el.classList.toggle("ghost", !on[id] && !!gh[id]);
    });
  }

  function dotsForMidi(midi) {
    const f = lookupWritten(midi);
    const keys = (f && f.keys) || [];
    const has = {};
    keys.forEach(function (k) { has[k] = true; });
    return {
      oct: !!has.octave,
      left: [!!has.L1, !!has.L2, !!has.L3],
      right: [!!has.R1, !!has.R2, !!has.R3],
      extra: keys.filter(function (k) {
        return ["L1", "L2", "L3", "R1", "R2", "R3", "octave"].indexOf(k) === -1;
      })
    };
  }

  global.Fingerings = {
    MIDI_MIN: MIDI_MIN,
    MIDI_MAX: MIDI_MAX,
    ALTO_TRANSPOSE: ALTO_TRANSPOSE,
    BY_MIDI: BY_MIDI,
    KEY_INFO: KEY_INFO,
    midiToName: midiToName,
    nameToMidi: nameToMidi,
    prettyName: prettyName,
    concertName: concertName,
    lookupWritten: lookupWritten,
    concertToWritten: concertToWritten,
    writtenToConcert: writtenToConcert,
    midiToFreq: midiToFreq,
    renderSax: renderSax,
    setKeys: setKeys,
    dotsForMidi: dotsForMidi,
    keyFullName: keyFullName,
    keysPhrase: keysPhrase,
    bindKeyTips: bindKeyTips
  };
})(window);
