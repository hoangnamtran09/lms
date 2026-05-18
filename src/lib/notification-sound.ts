const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || (window as any).webkitAudioContext) : null;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone(
  freq: number,
  duration: number,
  startTime: number,
  gain: number = 0.15,
  type: OscillatorType = "sine"
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  vol.gain.setValueAtTime(gain, startTime);
  vol.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(vol);
  vol.connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Pleasant ascending two-tone chime — for AI response complete
export function playAIResponseSound() {
  const now = getCtx()?.currentTime ?? 0;
  playTone(660, 0.25, now, 0.12, "sine");
  playTone(880, 0.35, now + 0.1, 0.10, "sine");
}

// Bright "ding" — for correct answer
export function playCorrectAnswerSound() {
  const now = getCtx()?.currentTime ?? 0;
  playTone(880, 0.15, now, 0.12, "sine");
  playTone(1100, 0.25, now + 0.08, 0.10, "sine");
}
