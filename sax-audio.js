/**
 * Concert-pitch alto sax audio.
 * Fingering stays written; this module only plays concert MIDI (written − 9).
 * Primary: FluidR3_GM alto sax samples. Backup: reed-like rendered buffers.
 * Oscillator is never the main timbre; only a last-resort silent path.
 */
(function (global) {
  const SAMPLE_FILES = [
    { name: "Eb3", midi: 51, url: "samples/Eb3.mp3" },
    { name: "Bb3", midi: 58, url: "samples/Bb3.mp3" },
    { name: "Eb4", midi: 63, url: "samples/Eb4.mp3" },
    { name: "Bb4", midi: 70, url: "samples/Bb4.mp3" },
    { name: "Eb5", midi: 75, url: "samples/Eb5.mp3" },
    { name: "G5", midi: 79, url: "samples/G5.mp3" }
  ];

  const ATTACK = 0.018;
  const RELEASE = 0.18;
  const WET = 0.15;
  const SAMPLE_PEAK = 0.72;
  const SYNTH_PEAK = 0.38;

  const api = {
    ready: false,
    voice: "sample",
    muted: false,
    sampleOk: false,
    synthOk: false,
    status: "載入中…"
  };

  let ctx = null;
  let volumeGain = null;
  let muteGain = null;
  let dryGain = null;
  let wetGain = null;
  let convolver = null;
  let sampleBufs = [];
  let synthBufs = [];
  let voices = [];
  let loadPromise = null;
  const rawCache = {};
  SAMPLE_FILES.forEach(function (spec) {
    fetch(spec.url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (b) {
      if (b) rawCache[spec.name] = b;
    }).catch(function () { /* decode path will retry */ });
  });

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function nearest(list, midi) {
    let best = list[0];
    let bestD = 99;
    for (let i = 0; i < list.length; i++) {
      const d = Math.abs(list[i].midi - midi);
      if (d < bestD) {
        best = list[i];
        bestD = d;
      }
    }
    return best;
  }

  function makeImpulse(ac, seconds) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * (0.7 + 0.3 * Math.sin(i * 0.013 + ch));
      }
    }
    return buf;
  }

  function renderReed(ac, midi, seconds) {
    const sr = ac.sampleRate;
    const off = new OfflineAudioContext(1, Math.ceil(sr * seconds), sr);
    const f = midiToFreq(midi);
    const osc = off.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    const tri = off.createOscillator();
    tri.type = "triangle";
    tri.frequency.value = f * 1.002;
    const bp = off.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(Math.max(f * 2.2, 420), 2600);
    bp.Q.value = 4.5;
    const body = off.createBiquadFilter();
    body.type = "bandpass";
    body.frequency.value = 780;
    body.Q.value = 1.15;
    const lp = off.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(f * 6 + 700, 4200);
    const g = off.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(0.42, 0.028);
    g.gain.setValueAtTime(0.36, seconds * 0.55);
    g.gain.linearRampToValueAtTime(0.28, seconds * 0.92);

    const nbuf = off.createBuffer(1, Math.ceil(sr * seconds), sr);
    const nd = nbuf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < nd.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.98;
      nd[i] = brown + (Math.random() * 2 - 1) * 0.04;
    }
    const ns = off.createBufferSource();
    ns.buffer = nbuf;
    const hp = off.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600;
    const ng = off.createGain();
    ng.gain.setValueAtTime(0.0001, 0);
    ng.gain.exponentialRampToValueAtTime(0.07, 0.04);
    ng.gain.setValueAtTime(0.045, seconds * 0.9);

    osc.connect(bp);
    tri.connect(bp);
    bp.connect(body);
    body.connect(lp);
    lp.connect(g);
    g.connect(off.destination);
    ns.connect(hp);
    hp.connect(ng);
    ng.connect(off.destination);
    osc.start(0);
    tri.start(0);
    ns.start(0);
    return off.startRendering();
  }

  async function loadMp3(ac, spec) {
    let raw = rawCache[spec.name];
    if (!raw) {
      const res = await fetch(spec.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      raw = await res.arrayBuffer();
    }
    return await ac.decodeAudioData(raw.slice(0));
  }

  async function buildSynth(ac) {
    const out = [];
    for (let i = 0; i < SAMPLE_FILES.length; i++) {
      const spec = SAMPLE_FILES[i];
      const buf = await renderReed(ac, spec.midi, 1.8);
      out.push({ name: spec.name, midi: spec.midi, buffer: buf });
    }
    return out;
  }

  async function buildSamples(ac) {
    const out = [];
    for (let i = 0; i < SAMPLE_FILES.length; i++) {
      const spec = SAMPLE_FILES[i];
      const buf = await loadMp3(ac, spec);
      out.push({ name: spec.name, midi: spec.midi, buffer: buf });
    }
    return out;
  }

  function connectGraph(ac) {
    volumeGain = ac.createGain();
    muteGain = ac.createGain();
    dryGain = ac.createGain();
    wetGain = ac.createGain();
    convolver = ac.createConvolver();
    convolver.buffer = makeImpulse(ac, 0.42);
    dryGain.gain.value = 1 - WET;
    wetGain.gain.value = WET;
    volumeGain.gain.value = 0.8;
    muteGain.gain.value = 1;
    dryGain.connect(volumeGain);
    convolver.connect(wetGain);
    wetGain.connect(volumeGain);
    volumeGain.connect(muteGain);
    muteGain.connect(ac.destination);
  }

  async function init(ac) {
    ctx = ac;
    if (!volumeGain) connectGraph(ac);
    if (loadPromise) return loadPromise;
    loadPromise = (async function () {
      try {
        synthBufs = await buildSynth(ac);
        api.synthOk = synthBufs.length > 0;
      } catch (e) {
        api.synthOk = false;
      }
      try {
        sampleBufs = await buildSamples(ac);
        api.sampleOk = sampleBufs.length > 0;
      } catch (e) {
        api.sampleOk = false;
      }
      if (!api.sampleOk && api.synthOk) {
        sampleBufs = synthBufs;
        api.sampleOk = true;
        api.status = "取樣載入失敗，已用簧片合成";
      } else if (api.sampleOk) {
        api.status = "FluidR3 Alto 取樣";
      } else {
        api.status = "無音源（靜音後備）";
      }
      api.ready = true;
      return api;
    })();
    return loadPromise;
  }

  function bank() {
    if (api.voice === "synth" && api.synthOk) return synthBufs;
    if (api.sampleOk) return sampleBufs;
    if (api.synthOk) return synthBufs;
    return [];
  }

  function loopPoints(buffer) {
    const dur = buffer.duration;
    return { start: Math.min(0.38, dur * 0.22), end: Math.max(dur * 0.78, 0.9) };
  }

  function releaseVoice(v, when) {
    try {
      const t = Math.max(when, ctx.currentTime);
      v.env.gain.cancelScheduledValues(t);
      const cur = Math.max(v.env.gain.value, 0.0001);
      v.env.gain.setValueAtTime(cur, t);
      v.env.gain.exponentialRampToValueAtTime(0.0001, t + RELEASE);
      v.src.stop(t + RELEASE + 0.02);
    } catch (e) { /* already stopped */ }
  }

  function play(concertMidi, when, durSec) {
    if (!ctx || concertMidi == null) return;
    const t0 = Math.max(when, ctx.currentTime);
    const list = bank();
    if (!list.length) return;

    const spec = nearest(list, concertMidi);
    const rate = midiToFreq(concertMidi) / midiToFreq(spec.midi);
    const src = ctx.createBufferSource();
    src.buffer = spec.buffer;
    src.playbackRate.value = rate;
    const lp = loopPoints(spec.buffer);
    if (durSec > lp.end - lp.start) {
      src.loop = true;
      src.loopStart = lp.start;
      src.loopEnd = lp.end;
    }

    const env = ctx.createGain();
    const peak = api.voice === "synth" ? SYNTH_PEAK : SAMPLE_PEAK;
    const t1 = t0 + Math.max(durSec, 0.09);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + ATTACK);
    env.gain.setValueAtTime(peak, Math.max(t0 + ATTACK, t1));
    env.gain.exponentialRampToValueAtTime(0.0001, t1 + RELEASE);

    src.connect(env);
    env.connect(dryGain);
    env.connect(convolver);
    src.start(t0, 0);
    src.stop(t1 + RELEASE + 0.03);

    voices.forEach(function (old) {
      if (old.alive) releaseVoice(old, t0);
      old.alive = false;
    });
    const voice = { src: src, env: env, alive: true };
    voices.push(voice);
    src.onended = function () {
      const i = voices.indexOf(voice);
      if (i >= 0) voices.splice(i, 1);
    };
  }

  function releaseAll() {
    if (!ctx) return;
    const now = ctx.currentTime;
    voices.forEach(function (v) {
      releaseVoice(v, now);
      v.alive = false;
    });
    voices = [];
  }

  function click(when, accent) {
    if (!ctx || api.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1480 : 880;
    const peak = accent ? 0.16 : 0.09;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g);
    g.connect(volumeGain);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  function setVolume(v) {
    if (volumeGain) volumeGain.gain.value = v;
  }

  function setMuted(on) {
    api.muted = !!on;
    if (muteGain) muteGain.gain.value = on ? 0 : 1;
  }

  function setVoice(name) {
    api.voice = name === "synth" ? "synth" : "sample";
  }

  global.SaxAudio = {
    init: init,
    play: play,
    releaseAll: releaseAll,
    click: click,
    setVolume: setVolume,
    setMuted: setMuted,
    setVoice: setVoice,
    api: api
  };
})(window);
