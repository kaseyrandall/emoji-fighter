// Full screen from fighter select through the fights: hides the browser bar.
// Supported by Android browsers, desktop browsers and iPad Safari; iPhone
// Safari has no page fullscreen (there, "Add to Home Screen" launches the game
// without the browser bar instead). Requests must come from a tap or click.

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as FsDocument;

// Launched from the home screen (standalone) there's no browser bar to hide.
// (Not "display-mode: fullscreen": a page in browser fullscreen matches that.)
const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const fullscreenSupported = () =>
  typeof document !== 'undefined' && !standalone() && !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);

export const isFullscreen = () => !!(doc().fullscreenElement || doc().webkitFullscreenElement);

export function enterFullscreen() {
  if (!fullscreenSupported() || isFullscreen()) return;
  const el = document.documentElement as FsElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    Promise.resolve(p)
      .then(() => {
        // Keep the phone in landscape while fullscreen, where the browser allows it.
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        o?.lock?.('landscape').catch(() => {});
      })
      .catch(() => {});
  } catch {
    /* refused: carry on with the browser bar */
  }
}

export function exitFullscreen() {
  if (!isFullscreen()) return;
  try {
    const p = document.exitFullscreen ? document.exitFullscreen() : doc().webkitExitFullscreen?.();
    Promise.resolve(p).catch(() => {});
  } catch {
    /* already gone */
  }
}

export function onFullscreenChange(cb: () => void) {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
  };
}
