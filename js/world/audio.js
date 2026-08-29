let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, duration, delay = 0, type = "sine", gain = 0.15 }) {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = c.currentTime + delay;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playInteract() {
  tone({ freq: 660, duration: 0.14, type: "triangle", gain: 0.12 });
  tone({ freq: 990, duration: 0.16, delay: 0.05, type: "sine", gain: 0.08 });
}

export function playMilestone() {
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    tone({ freq, duration: 0.22, delay: i * 0.09, type: "triangle", gain: 0.1 });
  });
}

export function playVictory() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone({ freq, duration: 0.35, delay: i * 0.12, type: "sine", gain: 0.12 });
  });
}

export function playCollect() {
  tone({ freq: 880, duration: 0.12, type: "sine", gain: 0.11 });
  tone({ freq: 1318.5, duration: 0.14, delay: 0.04, type: "sine", gain: 0.08 });
}

export function playCollectAll() {
  [659.25, 830.6, 987.77, 1174.66, 1567.98].forEach((freq, i) => {
    tone({ freq, duration: 0.3, delay: i * 0.08, type: "triangle", gain: 0.1 });
  });
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}
