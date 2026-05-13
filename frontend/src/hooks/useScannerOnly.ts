import { useEffect } from 'react';

/**
 * Blocks manual keyboard typing of printable characters.
 * Scanner input (rapid bursts < THRESHOLD_MS between chars) passes through.
 * Navigation keys (Enter, Tab, Backspace, Escape, arrows, F-keys) are never blocked.
 */
export function useScannerOnly(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const THRESHOLD_MS = 80; // scanners send chars < 30ms apart; human typing is > 80ms
    let lastPrintableTime = 0;

    const handler = (e: KeyboardEvent) => {
      // Never block: control / navigation / modifier combos
      if (
        e.key === 'Enter' || e.key === 'Tab' || e.key === 'Backspace' ||
        e.key === 'Delete' || e.key === 'Escape' ||
        e.key.startsWith('Arrow') || e.key.startsWith('F') ||
        e.ctrlKey || e.altKey || e.metaKey
      ) {
        lastPrintableTime = 0; // reset timing after a terminator/control key
        return;
      }

      if (e.key.length === 1) {
        const now = Date.now();
        const delta = now - lastPrintableTime;

        if (lastPrintableTime !== 0 && delta > THRESHOLD_MS) {
          // Gap too large → manual typing → block this character
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        lastPrintableTime = now;
      }
    };

    // Use capture phase so we intercept before inputs receive the event
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [enabled]);
}
