/**
 * Built-in demo: "Practice Riff"
 * Already in alto written pitch. 4/4, 90 BPM, 12 bars.
 * Uses only written G4 A4 Bb4 C5 D5 Eb5 F5 G5.
 * Mix of quarters + eighths, plus two whole-bar rests.
 */
(function (global) {
  function N(pitch, dur) {
    return { pitch: pitch, dur: dur, rest: false };
  }
  function R(dur) {
    return { pitch: null, dur: dur, rest: true };
  }

  global.DEMO_SONG = {
    title: "Practice Riff",
    bpm: 90,
    beatsPerBar: 4,
    beatType: 4,
    source: "demo",
    notes: [
      // 1  hook climb
      N("G4", 0.5), N("A4", 0.5), N("Bb4", 0.5), N("C5", 0.5), N("D5", 1), N("C5", 0.5), N("Bb4", 0.5),
      // 2
      N("A4", 0.5), N("Bb4", 0.5), N("C5", 0.5), N("D5", 0.5), N("Eb5", 1), N("D5", 0.5), N("C5", 0.5),
      // 3
      N("Bb4", 1), N("C5", 0.5), N("D5", 0.5), N("Eb5", 1), N("F5", 0.5), N("Eb5", 0.5),
      // 4  walk down
      N("D5", 1), N("C5", 1), N("Bb4", 1), N("A4", 1),
      // 5  run up to high G
      N("G4", 0.5), N("A4", 0.5), N("Bb4", 0.5), N("C5", 0.5), N("D5", 0.5), N("Eb5", 0.5), N("F5", 0.5), N("G5", 0.5),
      // 6  tumble
      N("G5", 1), N("F5", 0.5), N("Eb5", 0.5), N("D5", 1), N("C5", 0.5), N("Bb4", 0.5),
      // 7–8  rests (so REST handling is visible)
      R(4),
      R(4),
      // 9  hook returns
      N("G4", 0.5), N("G4", 0.5), N("A4", 0.5), N("Bb4", 0.5), N("C5", 1), N("D5", 0.5), N("Eb5", 0.5),
      // 10
      N("F5", 1), N("D5", 0.5), N("C5", 0.5), N("Bb4", 1), N("A4", 0.5), N("G4", 0.5),
      // 11
      N("A4", 1), N("Bb4", 0.5), N("C5", 0.5), N("D5", 1), N("C5", 0.5), N("Bb4", 0.5),
      // 12  tag
      N("A4", 0.5), N("G4", 0.5), N("A4", 0.5), N("Bb4", 0.5), N("G4", 2)
    ]
  };
})(window);
