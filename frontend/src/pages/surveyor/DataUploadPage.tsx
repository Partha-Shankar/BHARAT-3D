import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, FolderUp, Loader2, MapPinned, PackageCheck, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload, AlertTriangle,
} from 'lucide-react';
import { startGeneration } from '../../world/api';
import { useSurveyDraft, readyCount, type SlotState } from '../../survey/draft';
import { DATASET_SLOTS, acceptsFile, fmtBytes, manifest, sampleFile, simulateUpload, type DatasetSlot } from '../../survey/datasets';
import { SurveySteps } from '../../survey/Steps';
import { PolygonPreview } from '../../survey/PolygonPreview';
import { EmptyState, Page, ProgressRing, Tick } from '../../survey/ui';
import { CountUp } from '../../world/ui';

const IDLE: SlotState = { status: 'idle', progress: 0, checks: [] };

const SlotCard: React.FC<{
  slot: DatasetSlot; state: SlotState; onFile: (f: File) => void; onSample: () => void; onRemove: () => void; index: number;
}> = ({ slot, state, onFile, onSample, onRemove, index }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const last = useRef<{ p: number; t: number } | null>(null);
  const Icon = slot.icon;

  // transfer rate for the uploading state
  useEffect(() => {
    if (state.status !== 'uploading' || !state.file) {
      last.current = null;
      setRate(null);
      return;
    }
    const now = performance.now();
    if (last.current && now - last.current.t > 250) {
      const bytes = ((state.progress - last.current.p) / 100) * state.file.size;
      setRate(bytes / ((now - last.current.t) / 1000));
      last.current = { p: state.progress, t: now };
    } else if (!last.current) last.current = { p: state.progress, t: now };
  }, [state.progress, state.status, state.file]);

  const ready = state.status === 'ready';
  return (
    <div className={`b3-card p-4 flex flex-col gap-3 b3-rise ${ready ? '!border-[#1f7a72]/35' : ''}`} style={{ animationDelay: `${0.08 + index * 0.05}s` }}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-500 ${ready ? 'bg-[#1f7a72] text-white' : 'bg-[#1e4d6b]/8 text-[#1e4d6b]'}`}>
          {ready ? <Tick className="w-5 h-5" /> : <Icon className="w-[18px] h-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-[13.5px] text-[#1b3344] truncate">{slot.title}</h3>
            {ready && <span className="b3-chip b3-chip-real b3-pop">Validated</span>}
          </div>
          <p className="text-[11.5px] text-[#5c6e7c] leading-snug">{slot.feeds}</p>
        </div>
      </div>

      {state.status === 'idle' || state.status === 'error' ? (
        <div
          className={`b3-drop flex-1 min-h-[112px] flex flex-col items-center justify-center gap-1.5 text-center px-3 py-4 cursor-pointer ${over ? 'is-over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        >
          <Upload className={`w-5 h-5 transition-transform duration-500 ${over ? '-translate-y-1 text-[#1f7a72]' : 'text-[#7d8c97]'}`} />
          <div className="text-[12.5px] text-[#33495a]"><b>Drop a file</b> or click to browse</div>
          <div className="flex flex-wrap justify-center gap-1">
            {slot.formats.map((f) => <span key={f} className="font-mono text-[10px] text-[#7d8c97] bg-white/70 border border-[#e4dccf] rounded px-1">{f}</span>)}
          </div>
          <button type="button" className="text-[11.5px] text-[#1f7a72] font-semibold hover:underline underline-offset-2 mt-0.5"
            onClick={(e) => { e.stopPropagation(); onSample(); }}>
            Use the sample file
          </button>
          {state.status === 'error' && <div className="text-[11px] text-[#c0392b] flex items-center gap-1 b3-pop"><AlertTriangle className="w-3.5 h-3.5" /> {state.error}</div>}
          <input ref={input} type="file" hidden accept={slot.formats.join(',')}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="b3-well p-3 flex-1 min-h-[112px] space-y-2 b3-fade">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="font-mono truncate text-[#1b3344]" title={state.file?.name}>{state.file?.name}</span>
            <span className="text-[#7d8c97] shrink-0">{state.file ? fmtBytes(state.file.size) : ''}</span>
          </div>
          {state.status === 'uploading' && (
            <>
              <div className="b3-bar"><span className="b3-shimmer" style={{ width: `${state.progress}%` }} /></div>
              <div className="flex justify-between text-[11px] text-[#5c6e7c] b3-num">
                <span>Uploading · {state.progress}%</span>
                <span>{rate ? `${fmtBytes(rate)}/s` : ''}</span>
              </div>
            </>
          )}
          {state.status === 'validating' && (
            <div className="text-[11.5px] text-[#1e4d6b] flex items-center gap-2 b3-breathe">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Validating coordinate system, schema and coverage…
            </div>
          )}
          {ready && (
            <ul className="space-y-1 b3-stagger">
              {state.checks.map((c) => (
                <li key={c} className="text-[11.5px] text-[#33495a] flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1f7a72] mt-[1px] shrink-0" /> <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {ready && (
            <div className="flex gap-1.5 pt-1">
              <button type="button" className="b3-btn b3-btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => input.current?.click()}><RefreshCw className="w-3 h-3" /> Replace</button>
              <button type="button" className="b3-btn b3-btn-ghost !px-2 !py-1 !text-[11px] hover:!text-[#c0392b]" onClick={onRemove}><Trash2 className="w-3 h-3" /> Remove</button>
              {state.file?.sample && <span className="ml-auto b3-chip b3-chip-plain">Sample</span>}
              <input ref={input} type="file" hidden accept={slot.formats.join(',')}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DataUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get('project_id') || 'proj-001';
  const { draft, setSlot, resetSlots, clear } = useSurveyDraft();
  const cancels = useRef<Record<string, () => void>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => Object.values(cancels.current).forEach((c) => c()), []);

  if (!draft) {
    return (
      <Page>
        <div className="b3-head">
          <div>
            <div className="b3-eyebrow b3-rise">Survey package</div>
            <h1 className="b3-title mt-1.5 b3-rise b3-d1">Data ingestion</h1>
            <SurveySteps current={2} className="mt-3 b3-rise b3-d2" />
          </div>
        </div>
        <EmptyState icon={<MapPinned className="w-6 h-6" />} title="Select a survey area first"
          action={<button className="b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> Select an area</button>}>
          Survey data is attached to an area. Draw it on the map, or click a spot to drop a survey square, then come back here to attach the drone,
          LiDAR, cadastral, sanction, floor-plan and utility datasets.
        </EmptyState>
      </Page>
    );
  }

  const total = DATASET_SLOTS.length;
  const done = readyCount(draft, total);
  const busy = DATASET_SLOTS.some((s) => ['uploading', 'validating'].includes(draft.slots[s.id]?.status ?? ''));
  const bytes = DATASET_SLOTS.reduce((a, s) => a + (draft.slots[s.id]?.status === 'ready' ? draft.slots[s.id]?.file?.size ?? 0 : 0), 0);

  const run = (slot: DatasetSlot, file: { name: string; size: number; sample: boolean }, delay = 0) => {
    cancels.current[slot.id]?.();
    cancels.current[slot.id] = simulateUpload(slot, draft, file, (s) => setSlot(slot.id, s), delay);
  };
  const onFile = (slot: DatasetSlot, f: File) => {
    if (!acceptsFile(slot, f.name)) {
      setSlot(slot.id, { ...IDLE, status: 'error', error: `${f.name.split('.').pop()?.toUpperCase()} is not a ${slot.title.toLowerCase()} format` });
      return;
    }
    run(slot, { name: f.name, size: f.size, sample: false });
  };
  const attachAll = () => {
    let i = 0;
    DATASET_SLOTS.forEach((slot) => {
      const st = draft.slots[slot.id]?.status;
      if (st === 'ready' || st === 'uploading' || st === 'validating') return;
      run(slot, sampleFile(slot, draft), i++ * 380);
    });
  };
  const remove = (slot: DatasetSlot) => {
    cancels.current[slot.id]?.();
    setSlot(slot.id, IDLE);
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const pkg = manifest(draft);
      const job = await startGeneration(draft.polygon, projectId, false, pkg);
      try {
        sessionStorage.setItem('bharat3d_last_package', JSON.stringify({ key: job.key, place: draft.place, datasets: pkg }));
      } catch { /* display only */ }
      clear();
      navigate(`/surveyor/generate?job=${job.job_id}&key=${job.key}&project_id=${projectId}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not start the reconstruction. Is the API running?');
      setStarting(false);
    }
  };

  return (
    <Page wide>
      <div className="b3-head">
        <div className="min-w-0">
          <div className="b3-eyebrow b3-rise">Survey package</div>
          <h1 className="b3-title mt-1.5 b3-rise b3-d1">Data ingestion</h1>
          <p className="text-sm text-[#5c6e7c] mt-2 max-w-2xl leading-relaxed b3-rise b3-d2">
            Attach the field survey for <b className="text-[#1b3344]">{draft.place || 'the selected area'}</b>. Each dataset feeds one part of the
            3D record. Once all six are validated, the area is reconstructed in 3D.
          </p>
        </div>
        <SurveySteps current={2} className="b3-rise b3-d3" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DATASET_SLOTS.map((slot, i) => (
            <SlotCard key={slot.id} index={i} slot={slot} state={draft.slots[slot.id] ?? IDLE}
              onFile={(f) => onFile(slot, f)} onSample={() => run(slot, sampleFile(slot, draft))} onRemove={() => remove(slot)} />
          ))}
        </div>

        <aside className="b3-card overflow-hidden lg:sticky lg:top-6 b3-slide-r b3-d2">
          <PolygonPreview polygon={draft.polygon} className="h-40 w-full" />
          <div className="p-4 space-y-4">
            <div>
              <div className="b3-serif text-lg leading-tight text-[#1b3344]">{draft.place || <span className="b3-skel inline-block h-5 w-40 align-middle" />}</div>
              <div className="text-[11px] text-[#7d8c97] font-mono mt-0.5">
                {draft.centre[1].toFixed(5)}°N {draft.centre[0].toFixed(5)}°E · {(draft.areaM2 / 1e6).toFixed(3)} km²
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ProgressRing value={done / total} size={68}>
                <div className="text-center leading-none">
                  <CountUp value={done} className="b3-serif text-xl text-[#1b3344]" /><span className="text-[11px] text-[#7d8c97]">/{total}</span>
                </div>
              </ProgressRing>
              <div className="text-[12px] text-[#33495a] space-y-0.5">
                <div className="font-semibold">{done === total ? 'Survey package complete' : busy ? 'Receiving datasets…' : `${total - done} dataset(s) to attach`}</div>
                <div className="text-[#7d8c97] b3-num">{fmtBytes(bytes || 1)} validated</div>
              </div>
            </div>

            <button className="w-full b3-btn !py-2" onClick={attachAll} disabled={done === total || busy}>
              <FolderUp className="w-4 h-4" /> Attach the sample survey package
            </button>
            <button className="w-full b3-btn b3-btn-teal !py-2.5 !text-[13px]" onClick={start} disabled={done < total || busy || starting}>
              {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting reconstruction…</>
                : done === total ? <><Sparkles className="w-4 h-4" /> Start 3D reconstruction <ArrowRight className="w-4 h-4" /></>
                  : <><PackageCheck className="w-4 h-4" /> Attach all six to continue</>}
            </button>
            {error && <div className="text-[11.5px] text-[#c0392b] bg-[#c0392b]/5 border border-[#c0392b]/25 rounded-lg p-2 b3-pop">{error}</div>}

            <div className="flex justify-between text-[11.5px]">
              <button className="text-[#1e4d6b] hover:underline underline-offset-2" onClick={() => navigate('/surveyor/area')}>Change area</button>
              {done > 0 && <button className="text-[#5c6e7c] hover:text-[#c0392b]" onClick={() => { Object.values(cancels.current).forEach((c) => c()); resetSlots(); }}>Clear all files</button>}
            </div>
            <div className="text-[11px] text-[#7d8c97] leading-relaxed border-t border-[#e4dccf] pt-3 flex gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1f7a72] shrink-0" />
              <span>Prototype ingestion: files are checked in this browser and listed in the survey record. The 3D model itself is reconstructed from open geodata for this polygon.</span>
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
};

export default DataUploadPage;
