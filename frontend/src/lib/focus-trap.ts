import React, { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal dialog focus management: moves focus into the container when it
 * opens, wraps Tab at the edges, and returns focus to the trigger on close.
 * Escape handling stays with the host component.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  ref: React.RefObject<T | null>
) {
  const restoreRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    restoreRef.current = document.activeElement;

    const items = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (x) => !x.hasAttribute("disabled") && x.getAttribute("aria-hidden") !== "true"
      );
    const first = items();
    if (first.length > 0) {
      first[0].focus();
    } else {
      el.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const head = list[0];
      const tail = list[list.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      const restore = restoreRef.current as HTMLElement | null;
      if (restore && typeof restore.focus === "function") {
        try {
          restore.focus();
        } catch {
          /* trigger unmounted — nothing to restore */
        }
      }
    };
  }, [active, ref]);
}
