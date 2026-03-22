import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps keyboard focus within a container when `active` is true.
 * Tab cycles through focusable elements; Shift+Tab cycles in reverse.
 * Esc key calls the optional onEscape callback.
 *
 * Usage:
 *   const ref = useFocusTrap(isOpen, () => setIsOpen(false));
 *   return <div ref={ref}>...</div>;
 */
export function useFocusTrap(
  active: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  // Remember what was focused before the trap activated
  const prevFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    prevFocusRef.current = document.activeElement;

    // Focus the first focusable element inside the container
    const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    const visible = Array.from(focusable).filter(
      (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'),
    );
    if (visible.length) visible[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab' || !ref.current) return;

      const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      const visible = Array.from(focusable).filter(
        (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'),
      );
      if (visible.length === 0) { e.preventDefault(); return; }

      const first = visible[0];
      const last = visible[visible.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !ref.current.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !ref.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the previously focused element when trap deactivates
      if (prevFocusRef.current && (prevFocusRef.current as HTMLElement).focus) {
        (prevFocusRef.current as HTMLElement).focus();
      }
    };
  }, [active, onEscape]);

  return ref;
}
