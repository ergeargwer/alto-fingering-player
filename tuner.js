/**
 * Local-only pitch detection for 對音.
 * Concert frequency → concert MIDI → written MIDI = concert + 9.
 * Never sends audio anywhere.
 */
(function (global) {
  const A4 = 440;
  const ALTO_TRANSPOSE = 9;
  const RMS_GATE = 0.01;
  const YIN_THRESHOLD = 0.12;
  const MIN_FREQ = 90;
  const MAX_FREQ = 1200;

  function midiToFreq(midi) {
    return A4 * Math.pow(2, (midi - 69) / 12);
  }

  function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / A4);
  }

  function centsVsFreq(freq, refFreq) {
    if (!freq || !refFreq || freq <= 0 || refFreq <= 0) return null;
    return 1200 * Math.log2(freq / refFreq);
  }

  function rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  /**
   * YIN (de Cheveigné & Kawahara): cumulative mean-normalized difference.
   * Returns frequency in Hz, or null.
   */
  function yin(buf, sampleRate) {
    const n = buf.length;
    if (n < 64 || !sampleRate) return null;
    const tauMin = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
    const tauMax = Math.min(n >> 1, Math.floor(sampleRate / MIN_FREQ));
    if (tauMax <= tauMin + 2) return null;

    const d = new Float32Array(tauMax + 2);
    for (let tau = tauMin; tau <= tauMax; tau++) {
      let sum = 0;
      const limit = n - tau;
      for (let i = 0; i < limit; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }

    const cmnd = new Float32Array(tauMax + 2);
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau] || 0;
      cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }

    let tauEst = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmnd[tau] < YIN_THRESHOLD) {
        while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
        tauEst = tau;
        break;
      }
    }
    if (tauEst < 0) {
      let best = tauMin;
      for (let tau = tauMin + 1; tau <= tauMax; tau++) {
        if (cmnd[tau] < cmnd[best]) best = tau;
      }
      if (cmnd[best] > 0.45) return null;
      tauEst = best;
    }

    const x0 = tauEst > 0 ? tauEst - 1 : tauEst;
    const x2 = tauEst + 1 <= tauMax ? tauEst + 1 : tauEst;
    let better = tauEst;
    if (x0 !== tauEst && x2 !== tauEst) {
      const s0 = cmnd[x0];
      const s1 = cmnd[tauEst];
      const s2 = cmnd[x2];
      const denom = 2 * s1 - s2 - s0;
      if (denom !== 0) better = tauEst + (s2 - s0) / (2 * denom);
    }
    if (better < 1) return null;
    return sampleRate / better;
  }

  function analyze(buf, sampleRate) {
    const level = rms(buf);
    if (level < RMS_GATE) {
      return { ok: false, rms: level, reason: "quiet" };
    }
    const freq = yin(buf, sampleRate);
    if (!freq || freq < MIN_FREQ || freq > MAX_FREQ) {
      return { ok: false, rms: level, reason: "noPitch", freq: freq || null };
    }
    const concertMidiFloat = freqToMidi(freq);
    const writtenMidiFloat = concertMidiFloat + ALTO_TRANSPOSE;
    return {
      ok: true,
      rms: level,
      freq: freq,
      concertMidiFloat: concertMidiFloat,
      writtenMidiFloat: writtenMidiFloat,
      concertMidi: Math.round(concertMidiFloat),
      writtenMidi: Math.round(writtenMidiFloat)
    };
  }

  function centsVsWritten(freq, writtenMidi) {
    const concertMidi = writtenMidi - ALTO_TRANSPOSE;
    return centsVsFreq(freq, midiToFreq(concertMidi));
  }

  /**
   * same written note + |cents|<25 match;
   * same note 25–50 near (sharp/flat);
   * different written note = wrong.
   */
  function verdict(analysis, targetWrittenMidi) {
    if (!analysis || !analysis.ok) {
      return { state: "silent", cents: null, heardWrittenMidi: null, sharp: null };
    }
    const cents = centsVsWritten(analysis.freq, targetWrittenMidi);
    const heard = analysis.writtenMidi;
    const same = heard === Math.round(targetWrittenMidi);
    const abs = Math.abs(cents);
    let state;
    if (!same) state = "wrong";
    else if (abs < 25) state = "match";
    else if (abs <= 50) state = "near";
    else state = "off";
    return {
      state: state,
      cents: cents,
      heardWrittenMidi: heard,
      sharp: cents > 0
    };
  }

  global.PitchTuner = {
    A4: A4,
    ALTO_TRANSPOSE: ALTO_TRANSPOSE,
    RMS_GATE: RMS_GATE,
    MIN_FREQ: MIN_FREQ,
    MAX_FREQ: MAX_FREQ,
    midiToFreq: midiToFreq,
    freqToMidi: freqToMidi,
    centsVsFreq: centsVsFreq,
    centsVsWritten: centsVsWritten,
    rms: rms,
    yin: yin,
    analyze: analyze,
    verdict: verdict
  };
})(window);
