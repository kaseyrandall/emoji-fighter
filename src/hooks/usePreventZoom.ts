import { useEffect } from 'react';

// iOS Safari ignores the viewport's `user-scalable=no` / `maximum-scale`, so we
// block the zoom gestures directly:
//   • pinch-zoom via Safari's non-standard `gesture*` events
//   • double-tap-to-zoom via a quick second `touchend`
// This does NOT touch scrolling (pan / touchmove) or the game's multi-touch
// pointer controls, and it deliberately ignores taps on buttons/links so rapid
// button mashing still registers every hit.
export function usePreventZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    // gesture* only exist on WebKit/iOS; harmless no-ops elsewhere.
    document.addEventListener('gesturestart', prevent as EventListener);
    document.addEventListener('gesturechange', prevent as EventListener);
    document.addEventListener('gestureend', prevent as EventListener);

    let lastTouchEnd = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) {
        const el = e.target as Element | null;
        // Let taps on interactive controls through (their own touch-action
        // already blocks zoom) so mashing isn't swallowed.
        if (!el || !el.closest('button, a, input, textarea, select, [role="button"]')) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    };
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', prevent as EventListener);
      document.removeEventListener('gesturechange', prevent as EventListener);
      document.removeEventListener('gestureend', prevent as EventListener);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
}
