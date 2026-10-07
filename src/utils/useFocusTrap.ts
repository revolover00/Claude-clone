import { useEffect, useRef } from "react";

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose?: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>
) {
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive) {
      // Store trigger element that had focus before opening
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      const container = containerRef.current;
      if (!container) return;

      // Focus target: either initialFocusRef or first focusable element
      const timer = setTimeout(() => {
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else {
          const focusable = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      }, 30);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Tab") {
          const focusable = Array.from(
            container.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

          if (focusable.length === 0) {
            e.preventDefault();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first || !container.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !container.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        } else if (e.key === "Escape") {
          if (onClose) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown, true);
        // Return focus to the trigger element on close
        if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
          setTimeout(() => {
            triggerElementRef.current?.focus();
          }, 10);
        }
      };
    }
  }, [isActive, containerRef, onClose, initialFocusRef]);
}
