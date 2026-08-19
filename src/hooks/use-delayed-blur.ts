import { useEffect, useRef } from 'react';

/** A focus/blur pair for a composer's primary text field, for when
 * blurring shouldn't immediately collapse the surrounding form. Tapping a
 * sibling control inside the same composer (a category pill, a due-date
 * chip...) blurs the text field a beat *before* that tap's own press event
 * finishes — an instant collapse on blur can unmount the very control
 * being tapped, silently swallowing the interaction entirely. A short
 * delay gives that tap time to land first; if focus genuinely moved
 * elsewhere, the collapse still happens, just ~150ms later than instant. */
export function useDelayedBlur(setFocused: (focused: boolean) => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function onFocus() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setFocused(true);
  }

  function onBlur() {
    timeoutRef.current = setTimeout(() => setFocused(false), 150);
  }

  return { onFocus, onBlur };
}
