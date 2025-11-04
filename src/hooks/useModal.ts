"use client";

import { useEffect, useRef, RefObject } from "react";

type UseModalOptions = {
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  preventBodyScroll?: boolean;
  autoFocus?: boolean;
};

/**
 * Hook for managing modal lifecycle (escape key, outside click, body scroll)
 */
export function useModal(
  isOpen: boolean,
  onClose: () => void,
  options: UseModalOptions = {},
): RefObject<HTMLDivElement | null> {
  const {
    closeOnEscape = true,
    closeOnOutsideClick = true,
    preventBodyScroll = true,
    autoFocus = false,
  } = options;

  const modalRef = useRef<HTMLDivElement>(null);
  const autoFocusRef = useRef<HTMLElement | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!preventBodyScroll || !isOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, preventBodyScroll]);

  // Close modal when clicking outside
  useEffect(() => {
    if (!closeOnOutsideClick || !isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, closeOnOutsideClick]);

  // Auto-focus element when modal opens
  useEffect(() => {
    if (!autoFocus || !isOpen) return;

    const focusElement = autoFocusRef.current || modalRef.current?.querySelector("textarea, input");
    if (focusElement && focusElement instanceof HTMLElement) {
      focusElement.focus();
    }
  }, [isOpen, autoFocus]);

  return modalRef;
}
