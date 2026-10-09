import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Pickaxe, Ruler, Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { AreaThumb, EmptyState, Page, PageHeader, Skeleton, placeOf, useScenes } from '../../survey/ui';

const LEVELS = [
  { k: 'Critical', c: '#c0392b', d: 'The trench reaches the asset in plan and in depth.' },
  { k: 'High', c: '#d4643a', d: 'Within the safety buffer, both in plan and vertically.' },
  { k: 'Medium', c: '#c8962e', d: 'Within the buffer plus 5 m in plan and 1 m vertically.' },
  { k: 'Low', c: '#1f7a72', d: 'Nothing within reach: eligible for a digital no-objection.' },
];

/** Utility desk: plan a trench against the subsurface network of any surveyed area. */
export const DigSafePage: React.FC = () => {
  const navigate = useNavigate();
  const { data: scenes, isLoading } = useScenes();
  return (
    <Page wide>
      <PageHeader eyebrow="Utility desk" title="Dig-safe planning"
        lead="Draw a trench on the ground and set its depth. Every metro tunnel, underpass, pipe, cable and basement under the area is tested with its safety buffer, using plan distance and vertical clearance, before anyone breaks ground." />

      <section className="grid md:grid-cols-[1.2fr_1fr] gap-4">
        <div className="b3-card p-5 b3-rise b3-d2">
          <h2 className="b3-serif text-lg text-[#1b3344]">How a dig check works</h2>
          <ol className="mt-3 space-y-3 b3-stagger">
            {[
              [Pickaxe, 'Open an area and press Dig check', 'The view switches to X-ray so the network below the street is visible.'],
              [Ruler, 'Click two points to lay the trench', 'A 1.5 m wide trench is drawn between them.'],
              [Layers, 'Set the depth', 'Results update live as the depth changes; assets at risk glow red.'],
            ].map(([Icon, t, d], i) => {
              const I = Icon as React.FC<{ className?: string }>;
              return (
                <li key={i} className="flex gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#c0392b]/10 text-[#c0392b] flex items-center justify-center shrink-0"><I className="w-4 h-4" /></span>
                  <div><div className="font-semibold text-[13px]">{t as string}</div><div className="text-[12px] text-[#5c6e7c]">{d as string}</div></div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="b3-card p-5 b3-rise b3-d3">
          <h2 className="b3-serif text-lg text-[#1b3344] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#1f7a72]" /> Risk levels</h2>
          <div className="mt-3 space-y-2.5 b3-stagger">
            {LEVELS.map((l) => (
              <div key={l.k} className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: l.c }} />
                <div className="text-[12.5px]"><b style={{ color: l.c }}>{l.k}</b> <span className="text-[#5c6e7c]">· {l.d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div>
        <h2 className="b3-serif text-xl text-[#1b3344] mb-3 b3-rise b3-d4">Choose the area of the works</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : !scenes?.length ? (
          <EmptyState title="No surveyed areas yet">Areas appear here once the survey team has generated them.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 b3-stagger">
            {scenes.map((m) => (
              <button key={m.key} onClick={() => navigate(`/3d-world/${m.key}?dig=1`)} className="b3-card is-hoverable overflow-hidden text-left group">
                <AreaThumb meta={m} className="h-32" />
                <div className="p-3.5">
                  <div className="font-semibold text-[13.5px] truncate">{placeOf(m)}</div>
                  <div className="text-[11px] text-[#7d8c97] b3-num">{m.subsurface_assets} subsurface assets on record</div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#c0392b]">
                    <Pickaxe className="w-3.5 h-3.5 transition-transform duration-500 group-hover:-rotate-12" /> Plan a trench here <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};

export default DigSafePage;
