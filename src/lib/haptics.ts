/**
 * Haptic feedback utility for a more native feel on supported devices (Android).
 * iOS WebKit does not support navigator.vibrate yet, but this is safe to call.
 */

export const haptics = {
  /**
   * Light impact, good for button taps or toggle changes.
   */
  light: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium impact, good for success states or significant actions.
   */
  medium: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
  },

  /**
   * Heavy impact, good for errors or destructive actions.
   */
  heavy: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([30]);
    }
  },

  /**
   * Success pattern: two quick vibrations.
   */
  success: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([10, 50, 20]);
    }
  },

  /**
   * Error pattern: three quick vibrations.
   */
  error: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([30, 50, 30, 50, 30]);
    }
  },
};
