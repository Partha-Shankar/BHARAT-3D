import React from 'react';
import { Play } from 'lucide-react';
import { OVERVIEW_DURATION, OVERVIEW_SIDEBAR_THUMB, useOverviewModal } from './overview';

/** "Watch the overview" in the workspace sidebar: a video thumbnail that opens the overview in a window. */
export const SidebarOverviewCard: React.FC = () => {
  const openOverview = useOverviewModal((s) => s.openOverview);
  return (
    <button
      type="button"
      onClick={() => openOverview('sidebar')}
      title="Watch the BHARAT 3D overview (1 minute)"
      aria-label="Watch the BHARAT 3D overview (one-minute video)"
      className="group block w-full text-left rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-[#8fd0c8]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8fd0c8] transition-shadow"
    >
      <span className="relative block aspect-[16/6] bg-[#0A1730]">
        <img src={OVERVIEW_SIDEBAR_THUMB} alt="" className="absolute inset-0 w-full h-full object-cover" width={480} height={180}
          loading="lazy" decoding="async" />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <span aria-hidden className="absolute left-2 bottom-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110">
          <Play className="w-3.5 h-3.5 text-[#1f8a7d] fill-current ml-0.5" />
        </span>
        <span aria-hidden className="absolute right-2 bottom-2 rounded px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-semibold tabular-nums">
          {OVERVIEW_DURATION}
        </span>
      </span>
      <span className="block px-2.5 py-1.5 bg-[#1e4d6b]/60 group-hover:bg-[#1e4d6b] transition-colors">
        <span className="block text-xs font-semibold text-[#f3efe6] truncate">Watch the overview</span>
        <span className="block text-[10px] text-[#8fb4c9] truncate">BHARAT 3D in one minute</span>
      </span>
    </button>
  );
};

export default SidebarOverviewCard;
