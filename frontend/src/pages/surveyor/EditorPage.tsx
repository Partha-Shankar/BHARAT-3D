import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Layers, LayoutPanelTop, Pencil, Plus, Route, TrainFront, Undo2, MoveDiagonal, ShieldCheck } from 'lucide-react';
import { AreaThumb, EmptyState, Page, PageHeader, Skeleton, fmtAgo, placeOf, useScenes } from '../../survey/ui';

const CAPS = [
  { icon: Building2, t: 'Buildings', d: 'Add, remove, rename, change use' },
  { icon: Layers, t: 'Floors & heights', d: 'Floors, floor-to-floor height, podium' },
  { icon: MoveDiagonal, t: 'Shape', d: 'Move, rotate and resize footprints' },
  { icon: LayoutPanelTop, t: 'Units', d: 'Units on every floor, or one floor' },
  { icon: TrainFront, t: 'Metro tunnels', d: 'Draw, re-route, set depth and buffer' },
  { icon: Route, t: 'Flyovers', d: 'Draw, re-route, set deck height' },
  { icon: ShieldCheck, t: 'Sanctions', d: 'Record sanctioned floors' },
  { icon: Undo2, t: 'Undo & reset', d: 'Every edit is logged and reversible' },
];

/** Entry to the surveyor 3D editor: what it does, and which area to open. */
export const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: scenes, isLoading } = useScenes();
  return (
    <Page wide>
      <PageHeader eyebrow="Review & correct" title="3D editor"
        lead="Correct the generated model where the open data is wrong or out of date. After every edit the floor plans, 3D ULPINs and compliance findings are recomputed, and the change is appended to the activity log."
        actions={<button className="b3-btn b3-btn-primary" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> New survey</button>} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 b3-stagger">
        {CAPS.map(({ icon: Icon, t, d }) => (
          <div key={t} className="b3-tile" style={{ '--accent': '#c8962e' } as React.CSSProperties}>
            <Icon className="w-5 h-5 text-[#8a5a12]" />
            <div className="font-semibold text-[13px] mt-2 text-[#1b3344]">{t}</div>
            <div className="text-[11.5px] text-[#7d8c97]">{d}</div>
          </div>
        ))}
      </section>

      <div>
        <h2 className="b3-serif text-xl text-[#1b3344] mb-3 b3-rise b3-d3">Choose an area to edit</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : !scenes?.length ? (
          <EmptyState title="No areas to edit yet" action={<button className="b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> Survey an area</button>}>
            Generate an area first; it opens here for review.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 b3-stagger">
            {scenes.map((m) => (
              <button key={m.key} onClick={() => navigate(`/3d-editor/${m.key}`)} className="b3-card is-hoverable overflow-hidden text-left group">
                <AreaThumb meta={m} className="h-32" />
                <div className="p-3.5">
                  <div className="font-semibold text-[13.5px] truncate">{placeOf(m)}</div>
                  <div className="text-[11px] text-[#7d8c97] b3-num">{m.buildings} buildings · {m.edits_count} edit(s) · {fmtAgo(m.updated_at)}</div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8a5a12]">
                    <Pencil className="w-3.5 h-3.5 transition-transform duration-500 group-hover:-rotate-12" /> Open in the editor
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

export default EditorPage;
