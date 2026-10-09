import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Box, Building2, Fingerprint, FolderUp, Layers3, Map as MapIcon, MapPinned, Plus, ShieldAlert, Network, Pencil, PackageCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSurveyDraft, readyCount } from '../../survey/draft';
import { DATASET_SLOTS } from '../../survey/datasets';
import {
  AreaThumb, EmptyState, FINDING_LABEL, Page, Skeleton, StatTile, fmtAgo, placeOf, useCanEdit, useFindings, useRoleBase, useScenes,
} from '../../survey/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Workspace home: live totals across every generated area, the survey in progress, and recent areas. */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const base = useRoleBase();
  const canEdit = useCanEdit();
  const { data: scenes, isLoading } = useScenes();
  const { data: findings } = useFindings();
  const draft = useSurveyDraft((s) => s.draft);

  const totals = useMemo(() => {
    if (!scenes) return null;
    return scenes.reduce(
      (t, s) => ({
        areas: t.areas + 1, km2: t.km2 + s.area_m2 / 1e6, buildings: t.buildings + (s.buildings || 0),
        vprids: t.vprids + (s.vprids_reserved || 0), findings: t.findings + (s.violations || 0), subsurface: t.subsurface + (s.subsurface_assets || 0),
      }),
      { areas: 0, km2: 0, buildings: 0, vprids: 0, findings: 0, subsurface: 0 },
    );
  }, [scenes]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    (findings ?? []).forEach((f) => { m[f.type] = (m[f.type] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [findings]);
  const maxType = byType[0]?.[1] ?? 1;
  const critical = (findings ?? []).filter((f) => f.severity === 'CRITICAL').length;
  const recent = (scenes ?? []).slice(0, 4);
  const done = readyCount(draft, DATASET_SLOTS.length);

  return (
    <Page wide>
      {/* hero */}
      <section className="relative overflow-hidden rounded-2xl bg-[#1e4d6b] text-[#f3efe6] px-7 py-7 b3-rise">
        <div aria-hidden className="absolute -right-10 -top-16 w-80 h-80 rounded-full bg-[#1f7a72]/30 blur-3xl b3-breathe" />
        <div aria-hidden className="absolute right-8 bottom-0 flex items-end gap-1.5 opacity-25">
          {[38, 62, 88, 54, 112, 74, 46, 96, 58].map((h, i) => (
            <span key={i} className="w-5 bg-[#8fd0c8] rounded-t-sm b3-rise" style={{ height: h, animationDelay: `${0.2 + i * 0.06}s` }} />
          ))}
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0c8]">{greeting()}, {user?.full_name?.split(' ')[0] ?? 'surveyor'}</div>
            <h1 className="b3-serif text-[32px] leading-tight mt-1.5">One ground identity, and a volume wherever the city rises or goes underground.</h1>
            <p className="text-[13.5px] text-[#d5e3ea] mt-2 leading-relaxed">
              Select any area in India, attach its survey package, and get its 3D land record: buildings, floors, units, tunnels and flyovers,
              each with its 3D ULPIN and compliance checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button onClick={() => navigate('/surveyor/area')} className="b3-btn !bg-[#f3efe6] !text-[#1e4d6b] !border-[#f3efe6] hover:!bg-white !py-2.5 !px-4">
                <Plus className="w-4 h-4" /> New survey
              </button>
            )}
            <button onClick={() => navigate(`${base}/map`)} className="b3-btn !bg-transparent !text-[#f3efe6] !border-[#8fb4c9]/50 hover:!bg-[#173e56] !py-2.5 !px-4">
              <MapIcon className="w-4 h-4" /> Survey atlas
            </button>
          </div>
        </div>
      </section>

      {/* totals */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 b3-stagger">
        <StatTile label="Areas surveyed" value={totals?.areas} icon={<MapPinned className="w-4 h-4" />} hint={totals ? `${totals.km2.toFixed(2)} km² in total` : undefined}
          onClick={() => navigate(`${base}/projects`)} />
        <StatTile label="Buildings" value={totals?.buildings} icon={<Building2 className="w-4 h-4" />} hint="from open data + edits" />
        <StatTile label="3D ULPINs" value={totals?.vprids} icon={<Fingerprint className="w-4 h-4" />} accent="#c8962e" hint="VPRIDs reserved"
          onClick={() => navigate(`${base}/registry`)} />
        <StatTile label="Findings" value={totals?.findings} icon={<ShieldAlert className="w-4 h-4" />} accent="#c0392b"
          hint={findings ? `${critical} critical` : undefined} onClick={() => navigate(`${base}/violations`)} />
        <StatTile label="Subsurface assets" value={totals?.subsurface} icon={<Network className="w-4 h-4" />} hint="tunnels, utilities, basements" />
        <StatTile label="Area" value={totals ? +totals.km2.toFixed(2) : undefined} decimals={2} suffix="km²" icon={<Layers3 className="w-4 h-4" />} hint="modelled in 3D" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* recent areas */}
        <section className="b3-card p-5 b3-rise b3-d2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="b3-serif text-xl text-[#1b3344]">Recent areas</h2>
              <p className="text-xs text-[#5c6e7c]">Open any area in 3D, or continue editing it.</p>
            </div>
            <button className="b3-btn b3-btn-ghost" onClick={() => navigate(`${base}/projects`)}>All areas <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon={<MapPinned className="w-6 h-6" />} title="No areas yet"
              action={canEdit ? <button className="b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> Survey your first area</button> : undefined}>
              Generated areas will appear here with their buildings, 3D ULPINs and findings.
            </EmptyState>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 b3-stagger">
              {recent.map((m) => (
                <button key={m.key} onClick={() => navigate(`/3d-world/${m.key}`)} className="b3-card is-hoverable overflow-hidden text-left group">
                  <AreaThumb meta={m} className="h-28" />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[13.5px] text-[#1b3344] truncate">{placeOf(m)}</span>
                      <Box className="w-4 h-4 text-[#1f7a72] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                    </div>
                    <div className="text-[11px] text-[#7d8c97] mt-0.5 b3-num">
                      {m.buildings} buildings · {m.vprids_reserved.toLocaleString('en-IN')} 3D ULPINs · {m.violations} findings · {fmtAgo(m.updated_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-5">
          {/* survey in progress */}
          {canEdit && (
            <section className="b3-card p-5 b3-rise b3-d3">
              <h2 className="b3-serif text-xl text-[#1b3344]">Survey in progress</h2>
              {draft ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold truncate">{draft.place || 'Selected area'}</span>
                    <span className="text-[#7d8c97] b3-num">{(draft.areaM2 / 1e6).toFixed(3)} km²</span>
                  </div>
                  <div className="b3-bar"><span style={{ width: `${(done / DATASET_SLOTS.length) * 100}%`, transition: 'width 0.9s cubic-bezier(.22,1,.36,1)' }} /></div>
                  <div className="text-[11.5px] text-[#5c6e7c]">{done} of {DATASET_SLOTS.length} survey datasets attached</div>
                  <button className="w-full b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/upload')}>
                    <FolderUp className="w-4 h-4" /> Continue data ingestion
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-[12.5px] text-[#5c6e7c] leading-relaxed">Nothing in progress. A survey goes from the map to 3D in four steps:</p>
                  <ol className="space-y-2 b3-stagger">
                    {[
                      [MapPinned, 'Delineate', 'Draw the area, or click a spot on the map'],
                      [PackageCheck, 'Ingest data', 'Drone, LiDAR, parcels, sanctions, plans, utilities'],
                      [Box, 'Reconstruct 3D', 'Buildings, floors, tunnels, flyovers, terrain'],
                      [Pencil, 'Review & register', 'Correct in the editor; 3D ULPINs re-reserve'],
                    ].map(([Icon, t, d], i) => {
                      const I = Icon as React.FC<{ className?: string }>;
                      return (
                        <li key={t as string} className="flex gap-3 items-start">
                          <span className="w-7 h-7 rounded-lg bg-[#1e4d6b]/8 text-[#1e4d6b] flex items-center justify-center shrink-0 text-[11px] font-bold">{i + 1}</span>
                          <div className="text-[12.5px]"><div className="font-semibold flex items-center gap-1.5"><I className="w-3.5 h-3.5 text-[#1f7a72]" />{t as string}</div>
                            <div className="text-[#7d8c97] text-[11.5px]">{d as string}</div></div>
                        </li>
                      );
                    })}
                  </ol>
                  <button className="w-full b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> Start a survey</button>
                </div>
              )}
            </section>
          )}

          {/* findings by type */}
          <section className="b3-card p-5 b3-rise b3-d4">
            <div className="flex items-center justify-between">
              <h2 className="b3-serif text-xl text-[#1b3344]">Compliance at a glance</h2>
              <button className="b3-btn b3-btn-ghost !px-2" onClick={() => navigate(`${base}/violations`)}><ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            {!findings ? (
              <div className="space-y-2 mt-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5" />)}</div>
            ) : byType.length === 0 ? (
              <p className="text-[12.5px] text-[#5c6e7c] mt-2">No findings in the generated areas.</p>
            ) : (
              <div className="space-y-2.5 mt-3">
                {byType.map(([t, n], i) => (
                  <button key={t} className="w-full text-left group" onClick={() => navigate(`${base}/violations?type=${t}`)}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-[#33495a] group-hover:text-[#1b3344]">{FINDING_LABEL[t] ?? t}</span>
                      <span className="b3-num font-semibold">{n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#ebe4d6] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#c0392b] to-[#c8962e] b3-grow" style={{ width: `${(n / maxType) * 100}%`, animationDelay: `${0.25 + i * 0.07}s` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
};

export default DashboardPage;
