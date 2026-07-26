/**
 * Haptic feedback for the PWA.
 *
 * Reality check — there is no cross-platform web haptics API:
 *
 *  - Android (Chrome/Firefox): the Vibration API works. `navigator.vibrate`
 *    is the whole story, including in an installed PWA.
 *  - iOS (Safari, incl. installed PWAs): the Vibration API is NOT implemented
 *    and Apple exposes no JS haptics. The only known way to make an iPhone
 *    tap back from a web page is the native `<input type="checkbox" switch>`
 *    control (iOS 17.4+), which plays the system haptic when the *user*
 *    flips it — it cannot be triggered programmatically. So on iOS this
 *    module is a no-op by design, not by omission.
 *
 * Everything here degrades to a silent no-op, so call sites never branch.
 */

export type HapticPattern = 'tap' | 'success' | 'warning' | 'error';

// Kept short — long buzzes read as errors even when nothing is wrong
const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [14, 40, 14],
  warning: [22, 60, 22],
  error: [34, 60, 34, 60, 34],
};

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Fires a haptic pattern where supported; silently does nothing elsewhere. */
export function haptic(pattern: HapticPattern = 'tap'): void {
  if (!canVibrate()) return;
  if (typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration can throw when the document is not user-activated — ignore
  }
}
