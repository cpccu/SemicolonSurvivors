"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

const openDialogs = new Set<HTMLDialogElement>();
let originalOverflow = "";
let rootOpener: HTMLElement | null = null;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
}

export function Dialog({ open, onClose, title, description, children, className = "", initialFocus }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!openDialogs.size) {
      rootOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      originalOverflow = document.body.style.overflow;
    }
    openDialogs.add(dialog);
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    const frame = requestAnimationFrame(() => initialFocus?.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      openDialogs.delete(dialog);
      if (!openDialogs.size) {
        document.body.style.overflow = originalOverflow;
        if (rootOpener?.isConnected) rootOpener.focus({ preventScroll: true });
        rootOpener = null;
      }
    };
  }, [open, initialFocus]);

  return (
    <dialog ref={ref} className={`campus-dialog ${className}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button></div>
      {description && <p id={descriptionId} className="dialog-description">{description}</p>}
      {children}
    </dialog>
  );
}
