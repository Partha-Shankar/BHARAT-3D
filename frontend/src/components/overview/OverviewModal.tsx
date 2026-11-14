import React, { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { OVERVIEW_POSTER, OVERVIEW_WATCH_URL, overviewSrc, useOverviewModal } from './overview';

/** The overview in a window over any page (opened from the workspace sidebar). It plays with sound, since it was asked for. */
export const OverviewModal: React.FC = () => {
  const { open, close } = useOverviewModal();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[950] flex items-center justify-center p-4 sm:p-8 bg-[#06101F]/85 backdrop-blur-sm b3-fade"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="BHARAT 3D overview"
    >
      <div className="relative w-full max-w-[1040px] b3-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <div className="text-[12px] font-semibold tracking-[0.2em] uppercase text-[#5fc4b6]">Overview · 1 minute</div>
            <div className="mt-1 font-serif text-xl sm:text-2xl text-white">Every space, on record.</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a href={OVERVIEW_WATCH_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-[#8fb4c9] hover:text-white">
              YouTube <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button ref={closeRef} onClick={close} aria-label="Close the overview"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="relative aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] bg-[#050c18]">
          <img src={OVERVIEW_POSTER} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <iframe
            src={overviewSrc({ autoplay: true, muted: false })}
            title="BHARAT 3D overview"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default OverviewModal;
