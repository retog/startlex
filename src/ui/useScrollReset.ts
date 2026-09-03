import { useLayoutEffect } from 'react';

/**
 * Scrolls the window back to the top whenever `key` changes.
 *
 * The app has no router: switching screens (or phases inside a screen)
 * swaps the JSX in place, and the document keeps whatever scroll offset
 * the previous view had. On a phone that offset survives the swap and the
 * new view opens scrolled part-way down — its heading and the first input
 * (e.g. the check-in rating scale) sit above the fold and are only found by
 * dragging. Resetting on every view change makes each screen start at its
 * top, like a page navigation would.
 */
export function useScrollReset(key: unknown): void {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
