import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

const STEPS = [
  { n: 1, label: 'Delineate', to: '/surveyor/area' },
  { n: 2, label: 'Ingest data', to: '/surveyor/upload' },
  { n: 3, label: 'Reconstruct 3D', to: null },
  { n: 4, label: 'Review & register', to: null },
];

/** The survey journey: draw → attach the survey package → build the 3D record → review it in 3D. */
export const SurveySteps: React.FC<{ current: 1 | 2 | 3 | 4; className?: string }> = ({ current, className = '' }) => {
  const navigate = useNavigate();
  return (
    <ol className={`flex items-center gap-1.5 text-[11.5px] ${className}`}>
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const clickable = done && !!s.to;
        return (
          <React.Fragment key={s.n}>
            {i > 0 && (
              <li aria-hidden className="relative w-6 h-px bg-[#d9cdb8] overflow-hidden">
                <span className="absolute inset-0 bg-[#1f7a72] origin-left transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `scaleX(${s.n <= current ? 1 : 0})` }} />
              </li>
            )}
            <li>
              <button type="button" disabled={!clickable} onClick={() => clickable && navigate(s.to!)}
                className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 border transition-all duration-500 ${
                  active ? 'bg-[#1e4d6b] border-[#1e4d6b] text-white shadow-[0_6px_16px_-8px_rgba(30,77,107,0.7)]'
                    : done ? 'bg-[#1f7a72]/10 border-[#1f7a72]/30 text-[#1d6a52] hover:bg-[#1f7a72]/15' : 'bg-white/50 border-[#e4dccf] text-[#7d8c97]'
                }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold ${
                  active ? 'bg-white/20' : done ? 'bg-[#1f7a72] text-white' : 'bg-[#ebe4d6]'}`}>
                  {done ? <Check className="w-3 h-3 b3-pop" /> : s.n}
                </span>
                <span className="font-semibold whitespace-nowrap">{s.label}</span>
              </button>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};
