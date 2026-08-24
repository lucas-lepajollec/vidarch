const STORAGE_KEY = 'vidarch.player';
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export type PlayerPrefs = {
  volume: number;
  muted: boolean;
  playbackRate: number;
  theatre: boolean;
};

const DEFAULTS: PlayerPrefs = {
  volume: 1,
  muted: false,
  playbackRate: 1,
  theatre: false,
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function readPlayerPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
    const rate = Number(parsed.playbackRate);
    return {
      volume: clamp(Number(parsed.volume ?? DEFAULTS.volume), 0, 1),
      muted: !!parsed.muted,
      playbackRate: RATES.includes(rate) ? rate : DEFAULTS.playbackRate,
      theatre: !!parsed.theatre,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePlayerPrefs(patch: Partial<PlayerPrefs>): PlayerPrefs {
  const next = { ...readPlayerPrefs(), ...patch };
  next.volume = clamp(Number(next.volume) || 0, 0, 1);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function applyPlayerPrefs(el: HTMLVideoElement, prefs = readPlayerPrefs()): void {
  el.volume = prefs.volume;
  el.muted = prefs.muted;
  el.playbackRate = prefs.playbackRate;
}
