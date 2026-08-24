export const isDemoMode = import.meta.env.MODE === 'demo';

export const DEMO_VIDEO_PATH = '/demo/vidarch-demo.mp4';
export const DEMO_SESSION_KEY = 'vidarch-demo-intro-seen';

export function resetDemoSession(): void {
  if (!isDemoMode) return;
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  } catch {}
  window.location.assign('/');
}
