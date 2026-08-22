import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Align = 'start' | 'end' | 'center';
type Side = 'top' | 'bottom';

interface AnchoredPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  className?: string;
  align?: Align;
  preferredSide?: Side;
  offset?: number;
  children: React.ReactNode;
}

const PAD = 8;

export const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({
  open,
  onClose,
  anchorRef,
  className = '',
  align = 'end',
  preferredSide = 'bottom',
  offset = 8,
  children,
}) => {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 0, ready: false });

  const place = () => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;

    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxHeight = Math.max(120, vh - PAD * 2);
    pop.style.maxHeight = `${maxHeight}px`;

    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    const spaceBelow = vh - rect.bottom - offset - PAD;
    const spaceAbove = rect.top - offset - PAD;

    let side: Side = preferredSide;
    if (preferredSide === 'bottom' && spaceBelow < Math.min(popH, 160) && spaceAbove > spaceBelow) {
      side = 'top';
    } else if (preferredSide === 'top' && spaceAbove < Math.min(popH, 160) && spaceBelow > spaceAbove) {
      side = 'bottom';
    }

    let top: number;
    if (side === 'bottom') {
      top = rect.bottom + offset;
      if (top + popH > vh - PAD) top = Math.max(PAD, vh - PAD - popH);
    } else {
      top = rect.top - offset - popH;
      if (top < PAD) top = PAD;
    }

    let left =
      align === 'end'
        ? rect.right - popW
        : align === 'center'
          ? rect.left + rect.width / 2 - popW / 2
          : rect.left;
    left = Math.min(Math.max(PAD, left), Math.max(PAD, vw - PAD - popW));

    setPos({ top, left, maxHeight, ready: true });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos((prev) => ({ ...prev, ready: false }));
      return;
    }
    place();
    const onWin = () => place();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onWin) : null;
    if (popRef.current) ro?.observe(popRef.current);
    if (anchorRef.current) ro?.observe(anchorRef.current);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      ro?.disconnect();
    };
  }, [open, children, align, preferredSide, offset]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popRef}
      className={`va-menu ${className}`.trim()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        maxHeight: pos.maxHeight || undefined,
        overflowY: 'auto',
        visibility: pos.ready ? 'visible' : 'hidden',
        zIndex: 80,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};
