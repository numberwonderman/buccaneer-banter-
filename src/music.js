// The soundtrack. No sound files: the tune is written out below as notes and
// played by the browser's own synthesiser (Web Audio). It is an original
// 16-bar jig in D dorian, written for this game.
//
// Two moods share the one tune:
//   "shore"   title screen and beach: slow, soft, with the sea underneath
//   "tavern"  inside: up to speed, with bass, squeezebox chords and a hand drum
//
// Browsers only allow sound after the player has pressed a key or tapped, so
// the music starts at the first key or tap. M (or the on-screen button)
// switches it off and on; the choice is remembered for next time.
// If the browser has no Web Audio, everything here quietly does nothing.

const EIGHTHS_PER_BAR = 6;

// Melody: [MIDI note, length in eighth notes]. Each row is one bar of 6/8.
const TUNE = [
  [[62, 2], [65, 1], [69, 2], [74, 1]],
  [[72, 1], [69, 1], [65, 1], [69, 3]],
  [[67, 2], [72, 1], [76, 2], [72, 1]],
  [[71, 1], [67, 1], [64, 1], [67, 3]],
  [[69, 2], [74, 1], [77, 2], [76, 1]],
  [[74, 1], [72, 1], [69, 1], [72, 2], [69, 1]],
  [[67, 2], [64, 1], [67, 1], [69, 1], [71, 1]],
  [[69, 1], [65, 1], [64, 1], [62, 3]],
  [[69, 3], [72, 2], [69, 1]],
  [[67, 3], [64, 2], [67, 1]],
  [[65, 1], [67, 1], [69, 1], [74, 2], [69, 1]],
  [[76, 3], [72, 2], [69, 1]],
  [[77, 2], [76, 1], [74, 2], [72, 1]],
  [[76, 2], [74, 1], [72, 2], [67, 1]],
  [[69, 1], [72, 1], [76, 1], [74, 1], [72, 1], [71, 1]],
  [[74, 2], [69, 1], [62, 3]],
];
// One chord per bar: [root, third, fifth] as MIDI notes.
const Dm = [50, 53, 57], C = [48, 52, 55], F = [53, 57, 60], Am = [45, 48, 52];
const CHORDS = [Dm, Dm, C, C, Dm, F, C, Dm, F, C, Dm, Am, F, C, Am, Dm];

const MOODS = {
  shore:  { eighth: 0.30, lead: 0.16, leadShift: 0,  pad: 0.05, bass: 0,    drum: 0,    sea: 0.11 },
  tavern: { eighth: 0.175, lead: 0.15, leadShift: 0, pad: 0.045, bass: 0.2, drum: 0.16, sea: 0 },
};

const VOLUME = 0.55;
const KEY = "buccaneer-banter-music";

// What the rest of the game (and the tests) can read.
export const music = {
  available: false, started: false, muted: false, mood: null, notes: 0,
  // How loud the output is right now: { rms, peak }, each 0 to 1. For the tests,
  // which cannot hear: this is how they tell the tune is really sounding.
  level() {
    if (!meter) return { rms: 0, peak: 0 };
    const buf = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(buf);
    let sum = 0, peak = 0;
    for (const v of buf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    return { rms: Math.sqrt(sum / buf.length), peak };
  },
};

let ctx = null;
let master = null;
let meter = null;
let noise = null;
let bus = null;       // the current mood's output
let timer = null;
let bar = 0;
let nextBarAt = 0;
let wanted = "shore";
let button = null;

try { music.muted = localStorage.getItem(KEY) === "off"; } catch { /* storage not allowed: start with music on */ }

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

function tone({ type, midi, at, dur, gain, attack = 0.01, release = 0.08, cutoff = 0, detune = 0, out }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = hz(midi);
  o.detune.value = detune;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.setValueAtTime(gain, Math.max(at + attack, at + dur - release));
  g.gain.linearRampToValueAtTime(0, at + dur);
  let last = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    o.connect(f);
    last = f;
  }
  last.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
  music.notes++;
}

function thump(at, gain, out, high) {
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noise;
  f.type = high ? "bandpass" : "lowpass";
  f.frequency.value = high ? 1800 : 160;
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + (high ? 0.05 : 0.16));
  s.connect(f).connect(g).connect(out);
  s.start(at, Math.random());
  s.stop(at + 0.2);
}

function scheduleBar(m, at, out) {
  const e = m.eighth;
  const chord = CHORDS[bar];
  // The tune: a whistle (triangle) with a reedy edge an octave up.
  let t = at;
  for (const [note, len] of TUNE[bar]) {
    const dur = len * e * 0.94;
    tone({ type: "triangle", midi: note + m.leadShift, at: t, dur, gain: m.lead, attack: 0.02, release: Math.min(0.12, dur / 2), out });
    tone({ type: "square", midi: note + m.leadShift + 12, at: t, dur, gain: m.lead * 0.07, attack: 0.03, cutoff: 2600, out });
    t += len * e;
  }
  // Squeezebox chords on the two main beats of the bar.
  for (const beat of [0, 3]) {
    for (const n of chord) {
      tone({ type: "sawtooth", midi: n + 12, at: at + beat * e, dur: 2.6 * e, gain: m.pad, attack: 0.05, release: 0.15, cutoff: 1100, detune: n % 2 ? 6 : -6, out });
    }
  }
  if (m.bass) {
    tone({ type: "triangle", midi: chord[0] - 12, at, dur: 2.2 * e, gain: m.bass, out });
    tone({ type: "triangle", midi: chord[2] - 12, at: at + 3 * e, dur: 2.2 * e, gain: m.bass * 0.8, out });
  }
  if (m.drum) {
    for (let i = 0; i < EIGHTHS_PER_BAR; i++) {
      if (i % 3 === 0) thump(at + i * e, m.drum * (i ? 0.75 : 1), out, false);
      else thump(at + i * e, m.drum * 0.22, out, true);
    }
  }
}

function tick() {
  if (!ctx || !bus) return;
  const m = MOODS[music.mood];
  // After a pause (hidden tab, sleeping laptop) pick up from now, not from then.
  if (nextBarAt < ctx.currentTime - 0.05) nextBarAt = ctx.currentTime + 0.05;
  while (nextBarAt < ctx.currentTime + 0.35) {
    scheduleBar(m, nextBarAt, bus);
    nextBarAt += EIGHTHS_PER_BAR * m.eighth;
    bar = (bar + 1) % TUNE.length;
  }
}

// The sea: filtered noise that swells and falls every few seconds.
function addSea(level, out) {
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  s.buffer = noise;
  s.loop = true;
  f.type = "lowpass";
  f.frequency.value = 650;
  g.gain.value = level * 0.6;
  lfo.frequency.value = 0.13;
  depth.gain.value = level * 0.4;
  lfo.connect(depth).connect(g.gain);
  s.connect(f).connect(g).connect(out);
  s.start();
  lfo.start();
  return [s, lfo];
}

function startMood(name) {
  const now = ctx.currentTime;
  const old = bus;
  if (old) {
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 0.6);
    const loops = old.loops;
    setTimeout(() => { loops.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); old.disconnect(); }, 1500);
  }
  bus = ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + (old ? 0.9 : 0.4));
  bus.connect(master);
  bus.loops = MOODS[name].sea ? addSea(MOODS[name].sea, bus) : [];
  music.mood = name;
  bar = 0;
  nextBarAt = now + (old ? 0.5 : 0.1);
  tick();
}

// Called on the first key or tap. Safe to call again.
function unlock() {
  if (music.started || !music.available) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = music.muted ? 0 : VOLUME;
    const limiter = ctx.createDynamicsCompressor();
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    master.connect(limiter).connect(meter).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    music.started = true;
    startMood(wanted);
    timer = setInterval(tick, 100);
    ctx.resume?.();
  } catch {
    music.available = false; // no sound on this browser; the game carries on
    music.started = false;
  }
  drawButton();
}

// The scenes say which mood they want.
export function setMood(name) {
  if (!MOODS[name]) return;
  wanted = name;
  if (music.started && music.mood !== name) startMood(name);
}

export function toggleMusic() {
  music.muted = !music.muted;
  try { localStorage.setItem(KEY, music.muted ? "off" : "on"); } catch { /* not remembered, still works */ }
  if (master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(music.muted ? 0 : VOLUME, now + 0.15);
  }
  drawButton();
  return music.muted;
}

function drawButton() {
  if (!button) return;
  button.textContent = music.muted ? "Music: off" : "Music: on";
  button.setAttribute("aria-pressed", String(!music.muted));
  button.hidden = !music.available;
}

export function initMusic() {
  music.available = !!(window.AudioContext || window.webkitAudioContext);

  // A small button at the top, in the gap between the beat banner and the page
  // status. It is an ordinary HTML button so a tap on it never reaches the game.
  button = document.createElement("button");
  button.id = "music-toggle";
  button.type = "button";
  button.style.cssText = "position:fixed;transform:translate(-50%,-50%);z-index:20;white-space:nowrap;" +
    "font:bold 15px system-ui,sans-serif;color:#ffcd50;background:rgba(16,12,8,.85);border:2px solid #ffcd50;border-radius:8px;" +
    "padding:5px 8px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation";
  // Keep it over the same spot of the game picture however the picture is scaled.
  const place = () => {
    const c = document.querySelector("canvas");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const s = Math.min(r.width / 960, r.height / 540);
    button.style.left = `${r.x + (r.width - 960 * s) / 2 + 629 * s}px`;
    button.style.top = `${r.y + (r.height - 540 * s) / 2 + 32 * s}px`;
    button.style.fontSize = `${Math.max(11, Math.round(15 * s))}px`;
  };
  place();
  window.addEventListener("resize", place);
  setInterval(place, 1000);
  // Acts on the press itself (like the Talk button), so it is quick under a finger.
  // A click that did not come from a press is the keyboard (Enter on the button).
  const press = (e) => { e.stopPropagation(); e.preventDefault(); unlock(); toggleMusic(); button.blur(); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail === 0) press(e); });
  for (const ev of ["mousedown", "touchstart", "touchend"]) button.addEventListener(ev, (e) => e.stopPropagation());
  button.addEventListener("keydown", (e) => e.stopPropagation());
  document.body.appendChild(button);
  drawButton();

  window.addEventListener("keydown", (e) => {
    unlock();
    if ((e.key === "m" || e.key === "M") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleMusic();
  });
  for (const ev of ["pointerdown", "touchend"]) window.addEventListener(ev, unlock, { passive: true });
  // Do not play to an empty room.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.(); else ctx.resume?.();
  });
}
