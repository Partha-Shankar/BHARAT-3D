import React from 'react';
import { Play } from 'lucide-react';
import { OVERVIEW_THUMB, useOverviewModal } from './overview';

/** "Watch the overview" in the workspace sidebar: a small poster that opens the overview in a window. */
export const SidebarOverviewCard: React.FC = () => {
  const openOverview = useOverviewModal((s) => s.openOverview);
  return (
    <button
      type="button"
      onClick={() => openOverview('sidebar')}
      title="Watch the BHARAT 3D overview (1 minute)"
      className="group w-full flex items-center gap-2.5 rounded-sm p-1.5 hover:bg-[#1e4d6b] transition-colors text-left"
    >
      <span className="relative w-[68px] aspect-video rounded-[3px] overflow-hidden shrink-0 ring-1 ring-white/10 bg-[#0A1730]">
        <img src={OVERVIEW_THUMB} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
          <span className="w-5 h-5 rounded-full bg-white/95 flex items-center justify-center shadow transition-transform duration-300 group-hover:scale-110">
            <Play className="w-2.5 h-2.5 text-[#1f8a7d] fill-current ml-px" />
          </span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#f3efe6] truncate">Watch the overview</span>
        <span className="block text-[10px] text-[#8fb4c9] truncate">BHARAT 3D in one minute</span>
      </span>
    </button>
  );
};

export default SidebarOverviewCard;
