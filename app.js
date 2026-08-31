(function () {
  const F = window.Fingerings;
  const STORAGE = {
    tempo: "altoFingeringPlayer.tempo",
    mode: "altoFingeringPlayer.displayMode",
    countIn: "altoFingeringPlayer.countIn",
    slowStart: "altoFingeringPlayer.slowStart"
  };

  const MIN_DISPLAY_SEC = 0.3;
  const SLOW_START_SCALE = 0.7;

  const state = {
    song: null,
    events: [],
    totalBeats: 0,
    beatsPerBar: 4,
    tempo: 90,
    volume: 0.8,
    loop: true,
    playing: false,
    paused: false,
    concertFile: false,
    displayMode: "fingering",
    index: 0,
    playStartAudio: 0,
    playStartAbsBeat: 0,
    absBeat: 0,
    schedGen: 0,
    voices: [],
    wave: null,
    muted: false,
    voice: "sample",
    countIn: true,
    slowStart: false,
    countingIn: false,
    passIndex: 0,
    abA: 0,
    abB: 1,
    displayIndex: 0,
    displayHoldUntil: 0,
    dragHandle: null
  };

  let audioCtx = null;
  let rafId = 0;
  let schedTimer = 0;

  const el = {
    title: document.getElementById("song-title"),
    sub: document.getElementById("song-sub"),
    written: document.getElementById("written-name"),
    concert: document.getElementById("concert-name"),
    clock: document.getElementById("clock"),
    banner: document.getElementById("banner"),
    onboard: document.getElementById("onboard-notes"),
    sax: document.getElementById("sax-mount"),
    overlay: document.getElementById("status-overlay"),
    hero: document.getElementById("name-hero"),
    next: document.getElementById("next-hint"),
    strip: document.getElementById("strip-scroll"),
    stripPos: document.getElementById("strip-pos"),
    play: document.getElementById("btn-play"),
    stop: document.getElementById("btn-stop"),
    loop: document.getElementById("btn-loop"),
    prev: document.getElementById("btn-prev"),
    nextBtn: document.getElementById("btn-next"),
    progress: document.getElementById("progress"),
    fill: document.getElementById("progress-fill"),
    tempo: document.getElementById("tempo"),
    tempoVal: document.getElementById("tempo-val"),
    volume: document.getElementById("volume"),
    volVal: document.getElementById("vol-val"),
    file: document.getElementById("file-input"),
    demo: document.getElementById("btn-demo"),
    concertToggle: document.getElementById("concert-toggle"),
    partWrap: document.getElementById("part-wrap"),
    partSelect: document.getElementById("part-select"),
    pressed: document.getElementById("pressed-line"),
    tip: document.getElementById("key-tip"),
    nextCard: document.getElementById("next-card"),
    nextCardName: document.getElementById("next-card-name"),
    nextCardDur: document.getElementById("next-card-dur"),
    nextCardDots: document.getElementById("next-card-dots"),
    nextCardKeys: document.getElementById("next-card-keys"),
    countOverlay: document.getElementById("count-overlay"),
    countNum: document.getElementById("count-num"),
    countIn: document.getElementById("count-in"),
    slowStart: document.getElementById("slow-start"),
    handleA: document.getElementById("handle-a"),
    handleB: document.getElementById("handle-b"),
    progressAb: document.getElementById("progress-ab"),
    abLabel: document.getElementById("ab-label"),
    abReset: document.getElementById("ab-reset"),
    passBadge: document.getElementById("pass-badge"),
    mute: document.getElementById("btn-mute"),
    voiceSelect: document.getElementById("voice-select")
  };

  function showBanner(msg) {
    el.banner.textContent = msg;
    el.banner.classList.add("show");
  }
  function hideBanner() {
    el.banner.classList.remove("show");
    el.banner.textContent = "";
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function loadSettings() {
    const t = parseInt(localStorage.getItem(STORAGE.tempo), 10);
    if (Number.isFinite(t)) state.tempo = clamp(t, 40, 160);
    const m = localStorage.getItem(STORAGE.mode);
    if (m === "fingering" || m === "names" || m === "both") state.displayMode = m;
    el.tempo.value = String(state.tempo);
    el.tempoVal.textContent = String(state.tempo);
    const ci = localStorage.getItem(STORAGE.countIn);
    if (ci === "0" || ci === "1") state.countIn = ci === "1";
    const ss = localStorage.getItem(STORAGE.slowStart);
    if (ss === "0" || ss === "1") state.slowStart = ss === "1";
    if (el.countIn) el.countIn.checked = state.countIn;
    if (el.slowStart) el.slowStart.checked = state.slowStart;
    const voice = localStorage.getItem("altoFingeringPlayer.voice");
    if (voice === "sample" || voice === "synth") state.voice = voice;
    if (el.voiceSelect) el.voiceSelect.value = state.voice;
    if (localStorage.getItem("altoFingeringPlayer.muted") === "1") state.muted = true;
    setDisplayMode(state.displayMode, false);
  }

  function saveTempo() {
    localStorage.setItem(STORAGE.tempo, String(state.tempo));
  }
  function saveMode() {
    localStorage.setItem(STORAGE.mode, state.displayMode);
  }

  function setDisplayMode(mode, persist) {
    state.displayMode = mode;
    document.body.classList.remove("mode-fingering", "mode-names", "mode-both");
    document.body.classList.add("mode-" + mode);
    document.querySelectorAll(".mode-tabs .btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
    if (persist !== false) saveMode();
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      window.SaxAudio.init(audioCtx).then(function () {
        window.SaxAudio.setVoice(state.voice);
        window.SaxAudio.setVolume(state.volume);
        window.SaxAudio.setMuted(state.muted);
        updateMuteBtn();
      });
      window.SaxAudio.setVoice(state.voice);
      window.SaxAudio.setVolume(state.volume);
      window.SaxAudio.setMuted(state.muted);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function stopVoices() {
    if (window.SaxAudio) window.SaxAudio.releaseAll();
    state.voices = [];
  }

  function playSax(concertMidi, when, durSec) {
    if (window.SaxAudio) window.SaxAudio.play(concertMidi, when, durSec);
  }

  function playClick(when, accent) {
    if (window.SaxAudio) window.SaxAudio.click(when, accent);
  }

  function updateMuteBtn() {
    if (!el.mute) return;
    el.mute.classList.toggle("active", state.muted);
    el.mute.textContent = state.muted ? "取消靜音" : "靜音";
  }

  function compileSong(song, concertFile) {
    const events = [];
    let beat = 0;
    const notes = song.notes || [];
    notes.forEach(function (n) {
      const dur = Math.max(Number(n.dur) || 1, 0.0625);
      const rest = !!n.rest;
      let writtenMidi = null;
      if (!rest) {
        let srcMidi = n.midi != null ? n.midi : F.nameToMidi(n.pitch);
        if (srcMidi == null) {
          events.push({
            start: beat, dur: dur, rest: false, outOfRange: true,
            writtenMidi: null, concertMidi: null, name: n.pitch || "?"
          });
          beat += dur;
          return;
        }
        writtenMidi = concertFile ? F.concertToWritten(srcMidi) : srcMidi;
      }
      const fing = writtenMidi == null ? null : F.lookupWritten(writtenMidi);
      const out = !rest && (!fing || fing.outOfRange);
      const name = rest ? "REST" : (fing && fing.name) || F.midiToName(writtenMidi);
      events.push({
        start: beat,
        dur: dur,
        rest: rest,
        outOfRange: out,
        writtenMidi: writtenMidi,
        concertMidi: writtenMidi == null ? null : F.writtenToConcert(writtenMidi),
        name: name,
        keys: fing && !fing.outOfRange ? fing.keys : []
      });
      beat += dur;
    });
    return {
      events: events,
      totalBeats: beat || 1,
      beatsPerBar: song.beatsPerBar || 4,
      title: song.title || "Untitled"
    };
  }

  function loadSong(song, opts) {
    opts = opts || {};
    stopPlayback(opts.reset !== false);
    state.song = song;
    state.concertFile = !!opts.concertFile;
    el.concertToggle.checked = state.concertFile;
    const compiled = compileSong(song, state.concertFile);
    state.events = compiled.events;
    state.totalBeats = compiled.totalBeats;
    state.beatsPerBar = compiled.beatsPerBar;
    state.index = 0;
    state.absBeat = 0;
    el.title.textContent = compiled.title;
    const src = song.source === "demo" ? "示範曲" : song.source === "json" ? "JSON" : song.source === "musicxml" ? "MusicXML" : "";
    const pitchKind = state.concertFile ? "來源：實音 → 已移調 +9" : "記譜音高";
    const partBit = song.partName ? " · " + song.partName : "";
    el.sub.textContent = compiled.beatsPerBar + "/4 · " + src + partBit + " · " + pitchKind;
    fillPartSelect(song);
    state.abA = 0;
    state.abB = compiled.totalBeats;
    state.passIndex = 0;
    state.displayIndex = 0;
    state.displayHoldUntil = 0;
    renderStrip();
    paintAtBeat(0);
    updateClock(0);
    updateAbUi();
  }

  function tempoScale() {
    return (state.slowStart && state.passIndex === 0) ? SLOW_START_SCALE : 1;
  }

  function effectiveTempo() {
    return state.tempo * tempoScale();
  }

  function beatToTime(beats) {
    return beats * (60 / effectiveTempo());
  }

  function loopStart() {
    return clamp(state.abA, 0, Math.max(0, state.totalBeats - 0.25));
  }

  function loopEnd() {
    return clamp(state.abB, loopStart() + 0.25, state.totalBeats);
  }

  function nextIndexInLoop(i) {
    const a = loopStart();
    const b = loopEnd();
    const n = state.events.length;
    for (let k = 1; k <= n; k++) {
      const j = (i + k) % n;
      const ev = state.events[j];
      if (ev.start >= a - 1e-9 && ev.start < b - 1e-9) return j;
    }
    return (i + 1) % n;
  }

  function durLabel(beats) {
    const table = [
      [4, "全音符"], [3, "附點二分"], [2, "二分音符"], [1.5, "附點四分"],
      [1, "四分音符"], [0.75, "附點八分"], [0.5, "八分音符"], [0.375, "附點十六分"],
      [0.25, "十六分音符"], [0.125, "三十二分音符"]
    ];
    for (let i = 0; i < table.length; i++) {
      if (Math.abs(beats - table[i][0]) < 0.04) return table[i][1];
    }
    return (Math.round(beats * 100) / 100) + " 拍";
  }

  function nowSec() {
    if (audioCtx) return audioCtx.currentTime;
    return performance.now() / 1000;
  }

  function formatTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function wrapBeat(abs) {
    const t = state.totalBeats;
    if (t <= 0) return 0;
    let b = abs % t;
    if (b < 0) b += t;
    return b;
  }

  function indexAtBeat(beat) {
    const b = wrapBeat(beat);
    const ev = state.events;
    for (let i = 0; i < ev.length; i++) {
      if (b < ev[i].start + ev[i].dur - 1e-6) return i;
    }
    return Math.max(0, ev.length - 1);
  }

  function currentAbsBeat() {
    if (!state.playing || !audioCtx) return state.absBeat;
    if (state.countingIn && audioCtx.currentTime < state.playStartAudio) {
      return state.playStartAbsBeat;
    }
    return state.playStartAbsBeat + (audioCtx.currentTime - state.playStartAudio) * (effectiveTempo() / 60);
  }

  function updateClock(abs) {
    const songBeat = clamp(wrapBeat(abs), 0, state.totalBeats);
    const pos = songBeat * (60 / state.tempo);
    const tot = state.totalBeats * (60 / state.tempo);
    el.clock.textContent = formatTime(pos) + " / " + formatTime(tot);
    const pct = state.totalBeats ? (songBeat / state.totalBeats) * 100 : 0;
    el.fill.style.width = pct + "%";
    el.progress.setAttribute("aria-valuenow", String(Math.round(pct)));
    updateAbUi();
    updatePassBadge();
  }

  function updateAbUi() {
    if (!el.handleA || !state.totalBeats) return;
    const a = (loopStart() / state.totalBeats) * 100;
    const b = (loopEnd() / state.totalBeats) * 100;
    el.handleA.style.left = a + "%";
    el.handleB.style.left = b + "%";
    if (el.progressAb) {
      el.progressAb.style.left = a + "%";
      el.progressAb.style.width = Math.max(0, b - a) + "%";
    }
    if (el.abLabel) {
      const full = loopStart() <= 0.01 && loopEnd() >= state.totalBeats - 0.01;
      el.abLabel.textContent = full
        ? "A–B 全曲"
        : ("A–B 第" + (Math.floor(loopStart() / state.beatsPerBar) + 1) +
          "–" + Math.ceil(loopEnd() / state.beatsPerBar) + " 小節");
    }
  }

  function updatePassBadge() {
    if (!el.passBadge) return;
    if (state.slowStart && (state.playing || state.paused) && state.passIndex === 0) {
      el.passBadge.hidden = false;
      el.passBadge.textContent = "第一遍 70%";
    } else if (state.slowStart && state.playing && state.passIndex > 0) {
      el.passBadge.hidden = false;
      el.passBadge.textContent = "原速 100%";
    } else {
      el.passBadge.hidden = true;
    }
  }

  function renderNextCard(next) {
    if (!el.nextCardName) return;
    if (!next) {
      el.nextCardName.textContent = "—";
      el.nextCardDur.textContent = "";
      el.nextCardKeys.textContent = "";
      if (el.nextCardDots) el.nextCardDots.innerHTML = "";
      el.nextCard.classList.add("rest");
      return;
    }
    el.nextCard.classList.toggle("rest", !!next.rest);
    el.nextCardName.textContent = next.rest ? "休止" : F.prettyName(next.name);
    el.nextCardDur.textContent = durLabel(next.dur);
    if (next.rest) {
      el.nextCardKeys.textContent = "不按鍵";
      if (el.nextCardDots) el.nextCardDots.innerHTML = "";
    } else if (next.outOfRange) {
      el.nextCardKeys.textContent = "音域外";
      if (el.nextCardDots) el.nextCardDots.innerHTML = "";
    } else {
      el.nextCardKeys.textContent = F.keysPhrase(next.keys);
      if (el.nextCardDots && next.writtenMidi != null) {
        const dots = F.dotsForMidi(next.writtenMidi);
        el.nextCardDots.innerHTML = "";
        const mini = document.createElement("div");
        mini.className = "mini-dots";
        ["left", "right"].forEach(function (side) {
          const col = document.createElement("div");
          col.className = "mini-col";
          dots[side].forEach(function (on) {
            const d = document.createElement("div");
            d.className = "dot" + (on ? " on" : "");
            col.appendChild(d);
          });
          mini.appendChild(col);
        });
        el.nextCardDots.appendChild(mini);
      }
    }
  }

  function renderStrip() {
    el.strip.innerHTML = "";
    const barW = {};
    state.events.forEach(function (ev, i) {
      const bar = Math.floor(ev.start / state.beatsPerBar);
      if (!barW[bar]) {
        const row = document.createElement("div");
        row.className = "bar-row";
        row.dataset.bar = String(bar);
        const num = document.createElement("div");
        num.className = "bar-num";
        num.textContent = String(bar + 1);
        row.appendChild(num);
        el.strip.appendChild(row);
        barW[bar] = row;
      }
      const cell = document.createElement("div");
      cell.className = "note-cell" + (ev.rest ? " rest" : "") + (ev.outOfRange ? " out" : "");
      cell.dataset.index = String(i);
      const q = state.beatsPerBar;
      const w = Math.max(48, (ev.dur / q) * 280);
      cell.style.width = w + "px";
      cell.style.flex = "0 0 " + w + "px";

      const fill = document.createElement("div");
      fill.className = "dur-fill";
      fill.style.transform = "scaleX(0)";
      cell.appendChild(fill);

      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = ev.rest ? "休止" : F.prettyName(ev.name);
      cell.appendChild(name);

      const dur = document.createElement("div");
      dur.className = "cell-dur";
      const inner = document.createElement("i");
      inner.style.width = Math.min(100, ev.dur * 50) + "%";
      dur.appendChild(inner);
      cell.appendChild(dur);

      cell.addEventListener("click", function () {
        seekToIndex(i);
      });
      barW[bar].appendChild(cell);
    });
  }

  function paintAtBeat(abs) {
    if (!state.events.length) return;
    const musicalIndex = indexAtBeat(abs);
    const t = nowSec();
    if (musicalIndex !== state.displayIndex) {
      if (t < state.displayHoldUntil) {
        /* keep showing the held note */
      } else {
        state.displayIndex = musicalIndex;
        state.displayHoldUntil = t + MIN_DISPLAY_SEC;
      }
    }
    const i = clamp(state.displayIndex, 0, state.events.length - 1);
    const ev = state.events[i];
    const next = state.events[nextIndexInLoop(i)];
    const songBeat = wrapBeat(abs);
    const into = clamp((songBeat - ev.start) / ev.dur, 0, 1);
    const remain = 1 - into;

    state.index = i;

    const cells = el.strip.querySelectorAll(".note-cell");
    cells.forEach(function (c, idx) {
      c.classList.toggle("current", idx === i);
      const fill = c.querySelector(".dur-fill");
      if (!fill) return;
      fill.style.transform = idx === i ? "scaleX(" + remain + ")" : "scaleX(0)";
    });
    const curCell = cells[i];
    if (curCell) {
      const row = curCell.parentElement;
      const sc = el.strip;
      const top = row.offsetTop;
      const bottom = top + row.offsetHeight;
      const viewTop = sc.scrollTop;
      const viewBot = viewTop + sc.clientHeight;
      if (top < viewTop + 4 || bottom > viewBot - 4) {
        sc.scrollTop = Math.max(0, top - 8);
      }
    }

    el.stripPos.textContent = (i + 1) + " / " + state.events.length;

    if (ev.rest) {
      el.written.textContent = "休止";
      el.hero.textContent = "休止";
      el.concert.textContent = "REST";
      el.overlay.textContent = "休止 REST";
      el.overlay.className = "status-overlay show";
      F.setKeys(el.sax, [], next && !next.rest && !next.outOfRange ? next.keys : []);
      if (el.pressed) el.pressed.textContent = "目前按下：無（休止）";
    } else if (ev.outOfRange) {
      el.written.textContent = F.prettyName(ev.name);
      el.hero.textContent = F.prettyName(ev.name);
      el.concert.textContent = "音域外";
      el.overlay.textContent = "音域外";
      el.overlay.className = "status-overlay show warn";
      F.setKeys(el.sax, [], []);
      if (el.pressed) el.pressed.textContent = "目前按下：—";
    } else {
      el.written.textContent = F.prettyName(ev.name);
      el.hero.textContent = F.prettyName(ev.name);
      el.concert.textContent = "實音 " + F.concertName(ev.concertMidi);
      if (!ev.keys.length) {
        el.overlay.textContent = "開管";
        el.overlay.className = "status-overlay show";
      } else {
        el.overlay.className = "status-overlay";
      }
      const ghost = next && !next.rest && !next.outOfRange ? next.keys : [];
      F.setKeys(el.sax, ev.keys, ghost);
      if (el.pressed) el.pressed.textContent = "目前按下：" + F.keysPhrase(ev.keys);
    }

    if (next) {
      const label = next.rest ? "休止" : next.outOfRange ? F.prettyName(next.name) + "（音域外）" : F.prettyName(next.name);
      el.next.textContent = "下一音：" + label + (state.displayMode === "fingering" ? "  ·  虛線鍵＝預覽" : "");
    } else {
      el.next.textContent = "";
    }
    renderNextCard(next);
  }

  function scheduler() {
    if (!state.playing || !audioCtx) return;
    const gen = state.schedGen;
    const now = audioCtx.currentTime;
    if (state.countingIn) {
      updateCountOverlay();
      if (now >= state.playStartAudio) {
        state.countingIn = false;
        hideCountOverlay();
      }
    }
    const raw = currentAbsBeat();
    const a = loopStart();
    const b = loopEnd();
    const lookBeats = 0.22 * (effectiveTempo() / 60) + 0.45;

    state.events.forEach(function (ev, idx) {
      if (ev.rest || ev.outOfRange || ev.concertMidi == null) return;
      if (ev.start + 1e-6 < a || ev.start >= b - 1e-9) return;
      let absStart = ev.start;
      let delta = absStart - raw;
      if (delta < -0.02 && state.loop && raw > b - 0.5) {
        absStart = ev.start + (b - a);
        delta = absStart - raw;
      }
      if (delta < -0.02 || delta > lookBeats) return;
      const key = gen + ":" + state.passIndex + ":" + idx + ":" + Math.round(absStart * 1000);
      if (ev._sk === key) return;
      ev._sk = key;
      const when = state.playStartAudio + (absStart - state.playStartAbsBeat) * (60 / effectiveTempo());
      playSax(ev.concertMidi, when, beatToTime(ev.dur) * 0.96);
    });
  }

  function wrapLoopIfNeeded(raw) {
    const a = loopStart();
    const b = loopEnd();
    if (raw < b - 1e-6) return raw;
    if (state.slowStart && state.passIndex === 0) {
      state.passIndex = 1;
      state.schedGen += 1;
      state.events.forEach(function (e) { e._sk = null; });
      stopVoices();
      state.playStartAbsBeat = a;
      state.playStartAudio = audioCtx.currentTime;
      state.absBeat = a;
      return a;
    }
    if (state.loop) {
      state.schedGen += 1;
      state.events.forEach(function (e) { e._sk = null; });
      stopVoices();
      state.playStartAbsBeat = a;
      state.playStartAudio = audioCtx.currentTime;
      state.absBeat = a;
      return a;
    }
    stopPlayback(false);
    state.absBeat = b >= state.totalBeats ? 0 : b;
    return state.absBeat;
  }

  function updateCountOverlay() {
    if (!el.countOverlay || !audioCtx) return;
    const remain = state.playStartAudio - audioCtx.currentTime;
    const beatDur = 60 / effectiveTempo();
    const total = state.beatsPerBar * beatDur;
    const elapsed = total - remain;
    const beat = clamp(Math.floor(elapsed / beatDur) + 1, 1, state.beatsPerBar);
    el.countOverlay.hidden = false;
    el.countNum.textContent = String(beat);
  }

  function hideCountOverlay() {
    if (el.countOverlay) el.countOverlay.hidden = true;
  }

  function frame() {
    if (!state.playing) return;
    let abs = currentAbsBeat();
    if (state.countingIn) {
      updateCountOverlay();
      paintAtBeat(abs);
      updateClock(abs);
      rafId = requestAnimationFrame(frame);
      return;
    }
    abs = wrapLoopIfNeeded(abs);
    state.absBeat = abs;
    paintAtBeat(abs);
    updateClock(abs);
    rafId = requestAnimationFrame(frame);
  }

  function startPlayback(opts) {
    opts = opts || {};
    if (!state.events.length) return;
    ensureAudio();
    if (state.playing) return;
    const resume = !!opts.resume;
    let startBeat = state.absBeat;
    const a = loopStart();
    const b = loopEnd();
    if (!resume) {
      if (startBeat < a - 1e-6 || startBeat >= b - 1e-6) startBeat = a;
      state.passIndex = 0;
    }
    if (!state.loop && startBeat >= b - 1e-4) startBeat = a;

    state.playing = true;
    state.paused = false;
    state.schedGen += 1;
    state.events.forEach(function (e) { e._sk = null; });
    state.absBeat = startBeat;
    state.playStartAbsBeat = startBeat;
    state.displayIndex = indexAtBeat(startBeat);
    state.displayHoldUntil = nowSec() + MIN_DISPLAY_SEC;

    const doCountIn = state.countIn && !resume;
    const beatDur = 60 / effectiveTempo();
    const countBeats = state.beatsPerBar || 4;
    const t0 = audioCtx.currentTime + 0.03;
    if (doCountIn) {
      state.countingIn = true;
      for (let i = 0; i < countBeats; i++) {
        playClick(t0 + i * beatDur, i === 0);
      }
      state.playStartAudio = t0 + countBeats * beatDur;
      updateCountOverlay();
    } else {
      state.countingIn = false;
      hideCountOverlay();
      state.playStartAudio = t0;
    }
    el.play.textContent = "⏸ 暫停";
    updatePassBadge();
    paintAtBeat(startBeat);
    scheduler();
    clearInterval(schedTimer);
    schedTimer = setInterval(scheduler, 25);
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function pausePlayback() {
    if (!state.playing) return;
    if (state.countingIn && audioCtx && audioCtx.currentTime < state.playStartAudio) {
      state.absBeat = state.playStartAbsBeat;
      state.countingIn = false;
      hideCountOverlay();
      state.paused = false;
    } else {
      state.absBeat = currentAbsBeat();
      state.paused = true;
    }
    state.playing = false;
    state.countingIn = false;
    state.schedGen += 1;
    clearInterval(schedTimer);
    cancelAnimationFrame(rafId);
    stopVoices();
    hideCountOverlay();
    el.play.textContent = "▶ 播放";
    paintAtBeat(state.absBeat);
    updateClock(state.absBeat);
  }

  function stopPlayback(reset) {
    state.playing = false;
    state.paused = false;
    state.countingIn = false;
    state.passIndex = 0;
    state.schedGen += 1;
    clearInterval(schedTimer);
    cancelAnimationFrame(rafId);
    stopVoices();
    hideCountOverlay();
    el.play.textContent = "▶ 播放";
    if (reset) {
      state.absBeat = loopStart();
      state.index = indexAtBeat(state.absBeat);
      state.displayIndex = state.index;
      state.displayHoldUntil = 0;
    }
    if (state.events.length) {
      paintAtBeat(state.absBeat);
      updateClock(state.absBeat);
    }
    updatePassBadge();
  }

  function togglePlay() {
    if (state.playing) pausePlayback();
    else startPlayback({ resume: state.paused });
  }

  function seekToAbs(abs) {
    const was = state.playing;
    const resumeAfter = was && !state.countingIn;
    if (was) pausePlayback();
    state.absBeat = clamp(abs, 0, state.totalBeats);
    state.displayIndex = indexAtBeat(state.absBeat);
    state.displayHoldUntil = 0;
    paintAtBeat(state.absBeat);
    updateClock(state.absBeat);
    if (resumeAfter) startPlayback({ resume: true });
  }

  function seekToIndex(i) {
    i = clamp(i, 0, state.events.length - 1);
    seekToAbs(state.events[i].start + 0.0001);
  }

  function changeTempo(bpm) {
    bpm = clamp(bpm, 40, 160);
    const abs = currentAbsBeat();
    const counting = state.countingIn;
    state.tempo = bpm;
    el.tempo.value = String(bpm);
    el.tempoVal.textContent = String(bpm);
    saveTempo();
    if (state.playing && audioCtx) {
      stopVoices();
      state.schedGen += 1;
      state.events.forEach(function (e) { e._sk = null; });
      state.absBeat = abs;
      if (counting) {
        const beatDur = 60 / effectiveTempo();
        state.playStartAudio = audioCtx.currentTime + 0.03 + state.beatsPerBar * beatDur;
        for (let i = 0; i < state.beatsPerBar; i++) {
          playClick(audioCtx.currentTime + 0.03 + i * beatDur, i === 0);
        }
      } else {
        state.playStartAudio = audioCtx.currentTime;
        state.playStartAbsBeat = abs;
      }
    } else {
      updateClock(state.absBeat);
    }
  }

  function snapBeat(x) {
    return Math.round(x * 4) / 4;
  }

  function setAbFromClientX(which, clientX) {
    const r = el.progress.getBoundingClientRect();
    const pct = clamp((clientX - r.left) / r.width, 0, 1);
    let beat = snapBeat(pct * state.totalBeats);
    const gap = 0.25;
    if (which === "a") {
      state.abA = clamp(beat, 0, loopEnd() - gap);
    } else {
      state.abB = clamp(beat, loopStart() + gap, state.totalBeats);
    }
    updateAbUi();
  }

  function renderOnboarding() {
    const notes = ["G4", "A4", "Bb4", "C5", "D5", "Eb5"];
    el.onboard.innerHTML = "";
    notes.forEach(function (name) {
      const midi = F.nameToMidi(name);
      const dots = F.dotsForMidi(midi);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "onboard-card";
      card.dataset.midi = String(midi);
      const n = document.createElement("div");
      n.className = "n";
      n.textContent = F.prettyName(name);
      const oct = document.createElement("div");
      oct.className = "oct-pip" + (dots.oct || dots.extra.length ? " on" : "");
      oct.textContent = dots.oct ? "八度" : (dots.extra[0] && F.KEY_INFO[dots.extra[0]] ? F.KEY_INFO[dots.extra[0]].zh : " ");
      const mini = document.createElement("div");
      mini.className = "mini-dots";
      ["left", "right"].forEach(function (side) {
        const col = document.createElement("div");
        col.className = "mini-col";
        dots[side].forEach(function (on) {
          const d = document.createElement("div");
          d.className = "dot" + (on ? " on" : "");
          col.appendChild(d);
        });
        mini.appendChild(col);
      });
      card.appendChild(n);
      card.appendChild(oct);
      card.appendChild(mini);
      card.addEventListener("click", function () {
        document.querySelectorAll(".onboard-card").forEach(function (c) { c.classList.remove("active"); });
        card.classList.add("active");
        const fing = F.lookupWritten(midi);
        F.setKeys(el.sax, fing.keys, []);
        el.written.textContent = F.prettyName(name);
        el.hero.textContent = F.prettyName(name);
        el.concert.textContent = "實音 " + F.concertName(F.writtenToConcert(midi));
        el.overlay.className = "status-overlay";
        if (el.pressed) el.pressed.textContent = "目前按下：" + F.keysPhrase(fing.keys);
        if (!state.playing) {
          ensureAudio();
          playSax(F.writtenToConcert(midi), audioCtx.currentTime, 0.55);
        }
      });
      el.onboard.appendChild(card);
    });
  }

  function fillPartSelect(song) {
    if (!el.partWrap || !el.partSelect) return;
    const parts = (song && song.parts) || [];
    el.partSelect.innerHTML = "";
    if (song && song.source === "musicxml" && parts.length > 1) {
      parts.forEach(function (p) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name || p.id;
        if (p.id === song.partId) opt.selected = true;
        el.partSelect.appendChild(opt);
      });
      el.partWrap.hidden = false;
    } else {
      el.partWrap.hidden = true;
    }
  }

  function useDemo() {
    hideBanner();
    loadSong(window.DEMO_SONG, { concertFile: false, reset: true });
  }

  async function onFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const song = window.SongParser.parseFileText(text, file.name);
      hideBanner();
      if (!song.title || song.title === "匯入曲" || song.title === "JSON 曲") {
        song.title = file.name.replace(/\.(musicxml|xml|json)$/i, "");
      }
      loadSong(song, { concertFile: el.concertToggle.checked, reset: true });
    } catch (err) {
      showBanner("無法解析檔案，仍可播放示範曲。" + (err && err.message ? err.message : String(err)));
      useDemo();
    }
  }

  function onPartChange() {
    const song = state.song;
    if (!song || !song.rawXml) return;
    try {
      const next = window.SongParser.parseMusicXML(song.rawXml, { partId: el.partSelect.value });
      next.title = song.title;
      loadSong(next, { concertFile: el.concertToggle.checked, reset: true });
    } catch (err) {
      showBanner("此聲部無法解析：" + (err && err.message ? err.message : String(err)));
    }
  }

  function bind() {
    el.play.addEventListener("click", togglePlay);
    el.stop.addEventListener("click", function () { stopPlayback(true); });
    el.loop.addEventListener("click", function () {
      state.loop = !state.loop;
      el.loop.classList.toggle("active", state.loop);
    });
    el.prev.addEventListener("click", function () {
      const i = indexAtBeat(currentAbsBeat());
      const ev = state.events[i];
      const songBeat = wrapBeat(currentAbsBeat());
      if (ev && songBeat - ev.start > Math.min(0.25, ev.dur * 0.35)) seekToIndex(i);
      else seekToIndex(i - 1);
    });
    el.nextBtn.addEventListener("click", function () {
      seekToIndex(indexAtBeat(currentAbsBeat()) + 1);
    });
    el.tempo.addEventListener("input", function () {
      changeTempo(parseInt(el.tempo.value, 10));
    });
    el.volume.addEventListener("input", function () {
      state.volume = parseInt(el.volume.value, 10) / 100;
      el.volVal.textContent = el.volume.value;
      if (window.SaxAudio) window.SaxAudio.setVolume(state.volume);
    });
    el.progress.addEventListener("click", function (e) {
      if (state.dragHandle) return;
      if (e.target && e.target.classList && e.target.classList.contains("ab-handle")) return;
      const r = el.progress.getBoundingClientRect();
      const pct = clamp((e.clientX - r.left) / r.width, 0, 1);
      seekToAbs(pct * state.totalBeats);
    });
    function bindHandle(node, which) {
      if (!node) return;
      node.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        state.dragHandle = which;
        node.setPointerCapture(e.pointerId);
        setAbFromClientX(which, e.clientX);
      });
      node.addEventListener("pointermove", function (e) {
        if (state.dragHandle !== which) return;
        setAbFromClientX(which, e.clientX);
      });
      node.addEventListener("pointerup", function () {
        state.dragHandle = null;
      });
      node.addEventListener("pointercancel", function () {
        state.dragHandle = null;
      });
    }
    bindHandle(el.handleA, "a");
    bindHandle(el.handleB, "b");
    if (el.abReset) {
      el.abReset.addEventListener("click", function () {
        state.abA = 0;
        state.abB = state.totalBeats;
        updateAbUi();
      });
    }
    if (el.countIn) {
      el.countIn.addEventListener("change", function () {
        state.countIn = el.countIn.checked;
        localStorage.setItem(STORAGE.countIn, state.countIn ? "1" : "0");
      });
    }
    if (el.slowStart) {
      el.slowStart.addEventListener("change", function () {
        state.slowStart = el.slowStart.checked;
        localStorage.setItem(STORAGE.slowStart, state.slowStart ? "1" : "0");
        if (!state.slowStart) state.passIndex = 1;
        updatePassBadge();
      });
    }
    if (el.mute) {
      el.mute.addEventListener("click", function () {
        state.muted = !state.muted;
        localStorage.setItem("altoFingeringPlayer.muted", state.muted ? "1" : "0");
        ensureAudio();
        window.SaxAudio.setMuted(state.muted);
        updateMuteBtn();
      });
    }
    if (el.voiceSelect) {
      el.voiceSelect.addEventListener("change", function () {
        state.voice = el.voiceSelect.value === "synth" ? "synth" : "sample";
        localStorage.setItem("altoFingeringPlayer.voice", state.voice);
        if (window.SaxAudio) window.SaxAudio.setVoice(state.voice);
      });
    }
    el.file.addEventListener("change", function () {
      const f = el.file.files && el.file.files[0];
      if (f) onFile(f);
      el.file.value = "";
    });
    el.demo.addEventListener("click", useDemo);
    if (el.partSelect) el.partSelect.addEventListener("change", onPartChange);
    el.concertToggle.addEventListener("change", function () {
      if (!state.song) return;
      const abs = currentAbsBeat();
      const playing = state.playing;
      loadSong(state.song, { concertFile: el.concertToggle.checked, reset: false });
      state.absBeat = abs;
      paintAtBeat(abs);
      updateClock(abs);
      if (playing) startPlayback();
    });
    document.querySelectorAll(".mode-tabs .btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setDisplayMode(b.getAttribute("data-mode"), true);
        paintAtBeat(currentAbsBeat());
      });
    });
    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" && !/input|textarea|select/i.test(e.target.tagName)) {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        el.prev.click();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        el.nextBtn.click();
      }
    });
  }

  function init() {
    F.renderSax(el.sax);
    F.bindKeyTips(el.sax, el.tip);
    loadSettings();
    updateMuteBtn();
    renderOnboarding();
    bind();
    useDemo();
    const q = new URLSearchParams(location.search);
    if (q.get("mode")) setDisplayMode(q.get("mode"), false);
    if (q.get("seek")) {
      const i = parseInt(q.get("seek"), 10);
      if (Number.isFinite(i)) seekToIndex(i);
    }
    window.AltoApp = {
      state: state,
      loadSong: loadSong,
      compileSong: compileSong,
      Fingerings: F,
      parser: window.SongParser,
      MIN_DISPLAY_SEC: MIN_DISPLAY_SEC,
      SLOW_START_SCALE: SLOW_START_SCALE,
      effectiveTempo: effectiveTempo,
      loopStart: loopStart,
      loopEnd: loopEnd,
      durLabel: durLabel
    };
  }

  init();
})();
