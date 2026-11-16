/**
 * A single tip ("coach mark"): dims the page, lights up one element, points at it with an arrow and explains it in a
 * sentence or two. Only the OK button closes it. Not a tour: each tip stands alone.
 *
 * Each tip shows once per page load (a sign-in counts as a new load, see resetTips). When two tips are due at the same
 * time, the second waits until the first is closed. The tip is drawn in a portal on <body>, so page animations that
 * use transforms cannot trap its fixed positioning.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Lightbulb } from 'lucide-react';
import { trackAction } from '../../lib/track';
import { useServerBannerShowing } from '../ServerStatusBanner';

const shown = new Set<string>();
const useActiveTip = create<{ active: string | null }>(() => ({ active: null }));

/** Called after a successful sign-in, so the tips show again for the new visit. */
export function resetTips() {
  shown.clear();
}

type Placement = 'right' | 'left' | 'top' | 'bottom';
type Box = { top: number; left: number; width: number; height: number };

interface CoachMarkProps {
  /** unique name of this tip (also used in analytics) */
  id: string;
  /** CSS selector of the element to point at */
  target: string;
  title: string;
  children: React.ReactNode;
  /** show only while this is true */
  when?: boolean;
  /** wait this long after `when` becomes true */
  delayMs?: number;
  /** preferred side of the element for the tip; it moves to another side if there is no room */
  placement?: Placement;
  okLabel?: string;
}

const PAD = 6; // space between the element and the lit-up frame
const GAP = 14; // space between the frame and the tip (the arrow sits in it)
const CARD_W = 300;
const EDGE = 12;

function place(rect: Box, card: { w: number; h: number }, preferred: Placement): { side: Placement; top: number; left: number; arrow: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits: Record<Placement, boolean> = {
    right: rect.left + rect.width + GAP + card.w + EDGE <= vw,
    left: rect.left - GAP - card.w - EDGE >= 0,
    bottom: rect.top + rect.height + GAP + card.h + EDGE <= vh,
    top: rect.top - GAP - card.h - EDGE >= 0,
  };
  const order: Placement[] = [preferred, 'right', 'bottom', 'top', 'left'];
  const side = order.find((s) => fits[s]) ?? 'bottom';
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (side === 'right' || side === 'left') {
    const top = clamp(rect.top + rect.height / 2 - card.h / 2, EDGE, vh - card.h - EDGE);
    const left = side === 'right' ? rect.left + rect.width + GAP : rect.left - GAP - card.w;
    return { side, top, left, arrow: clamp(rect.top + rect.height / 2 - top, 16, card.h - 16) };
  }
  const left = clamp(rect.left + rect.width / 2 - card.w / 2, EDGE, vw - card.w - EDGE);
  const top = side === 'bottom' ? rect.top + rect.height + GAP : rect.top - GAP - card.h;
  return { side, top, left, arrow: clamp(rect.left + rect.width / 2 - left, 16, card.w - 16) };
}

export const CoachMark: React.FC<CoachMarkProps> = ({ id, target, title, children, when = true, delayMs = 0, placement = 'right', okLabel = 'OK' }) => {
  const [due, setDue] = useState(false);
  const [rect, setRect] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ w: CARD_W, h: 150 });
  const cardRef = useRef<HTMLDivElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const active = useActiveTip((s) => s.active);
  // Never on top of the server status banner: a due tip waits for it, an open one steps aside until it is gone.
  const bannerShowing = useServerBannerShowing((s) => s.showing);

  // Becomes due after the delay, once per page load.
  useEffect(() => {
    if (!when || shown.has(id)) {
      setDue(false); // no longer relevant (for example the visitor already opened what the tip points at)
      return;
    }
    const t = window.setTimeout(() => setDue(true), delayMs);
    return () => window.clearTimeout(t);
  }, [when, id, delayMs]);

  // Take the stage when it is free and the element is on the page.
  useEffect(() => {
    if (!due || shown.has(id) || (active && active !== id) || bannerShowing) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(target);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        window.clearInterval(t);
        if (useActiveTip.getState().active && useActiveTip.getState().active !== id) return;
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        shown.add(id);
        useActiveTip.setState({ active: id });
        trackAction('tip_shown', `Saw the tip "${title}"`, { tip: id });
      } else if (++tries > 40) {
        window.clearInterval(t); // the element never appeared (another layout): skip quietly
        setDue(false);
      }
    }, 150);
    return () => window.clearInterval(t);
  }, [due, active, id, target, title, bannerShowing]);

  const open = active === id && !bannerShowing;

  // Follow the element while the tip is open (resize, scroll, layout changes).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      if (cardRef.current) setCardSize({ w: cardRef.current.offsetWidth, h: cardRef.current.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const el = document.querySelector<HTMLElement>(target);
    if (el) ro.observe(el);
    if (cardRef.current) ro.observe(cardRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const t = window.setInterval(measure, 500); // panels that slide in or animate
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.clearInterval(t);
    };
  }, [open, target]);

  useEffect(() => {
    if (open && rect) okRef.current?.focus({ preventScroll: true });
  }, [open, rect]);

  if (!open || !rect) return null;
  const close = () => {
    trackAction('tip_ok', `Closed the tip "${title}"`, { tip: id });
    useActiveTip.setState({ active: null });
  };
  const p = place(rect, cardSize, placement);
  const arrowStyle: React.CSSProperties = p.side === 'right' ? { left: -7, top: p.arrow - 7 }
    : p.side === 'left' ? { right: -7, top: p.arrow - 7 }
      : p.side === 'bottom' ? { top: -7, left: p.arrow - 7 } : { bottom: -7, left: p.arrow - 7 };

  // A modal tip: keyboard focus stays on its only control, OK.
  const keepFocus = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      okRef.current?.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[980]" role="dialog" aria-modal="true" aria-labelledby={`tip-${id}-t`} aria-describedby={`tip-${id}-d`} onKeyDown={keepFocus}>
      {/* blocks the page; only OK closes the tip */}
      <div className="absolute inset-0" />
      {/* the lit-up element: everything else is dimmed by its huge shadow */}
      <div className="absolute rounded-xl pointer-events-none b3-coach-spot"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      <div ref={cardRef} className="absolute" style={{ top: p.top, left: p.left, width: `min(${CARD_W}px, calc(100vw - ${EDGE * 2}px))` }}>
        <div className="relative rounded-2xl bg-white shadow-[0_18px_50px_rgba(6,16,31,0.35)] ring-1 ring-black/5 p-4 b3-pop">
          <span className="absolute w-3.5 h-3.5 bg-white rotate-45 rounded-[2px]" style={arrowStyle} aria-hidden />
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-[#1f8a7d]/12 text-[#1f7a72] flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div id={`tip-${id}-t`} className="font-semibold text-[14.5px] text-[#16324a] leading-snug">{title}</div>
              <div id={`tip-${id}-d`} className="mt-1 text-[13px] leading-relaxed text-[#3d5363]">{children}</div>
            </div>
          </div>
          <div className="mt-3.5 flex justify-end">
            <button ref={okRef} onClick={close} className="bg-[#1f7a72] hover:bg-[#18655e] text-white font-semibold text-[13.5px] px-5 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a72]/40 focus-visible:ring-offset-2">
              {okLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CoachMark;
