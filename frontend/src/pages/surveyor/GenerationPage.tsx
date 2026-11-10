import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, XCircle, Box, ArrowRight, RotateCcw, RefreshCw, ChevronDown, CloudOff, AlertTriangle } from 'lucide-react';
import { getJob, startGeneration } from '../../world/api';
import type { GenerationJob, DatasetManifest } from '../../world/sceneSpec';
import { CountUp, StrataLoader } from '../../world/ui';
import { SurveySteps } from '../../survey/Steps';
import { fmtBytes } from '../../survey/datasets';
import { Thinking } from '../../survey/Thinking';
import { STAGE_THOUGHTS, overallProgress, clock, durationText } from '../../survey/generationCopy';
import { trackAction, track } from '../../lib/track';

interface LastPackage { key: string; place?: string; datasets: DatasetManifest[]; polygon?: GeoJSON.Polygon; retries?: number }
interface AreaCheckNote { key: string; buildings?: number; eta_s?: number }

const PACKAGE_KEY = 'bharat3d_last_package';
const AUTO_RETRY_S = 15; // a "map servers busy" failure restarts by itself once, after this countdown
const MAX_AUTO_RETRIES = 1;

const readJSON = <T,>(name: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(name) || 'null');
  } catch {
    return null;
  }
};

const LOG_DOT: Record<string, string> = {
  stage: 'bg-[#1f7a72]', note: 'bg-[#9aa6ae]', retry: 'bg-[#c8962e]', error: 'bg-[#c0392b]', done: 'bg-[#1d6a52]',
};

export const GenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get('job') || '';
  const key = params.get('key') || '';
  const projectId = params.get('project_id') || 'proj-001';
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [lostContact, setLostContact] = useState(false);
  const pkg = useMemo(() => {
    const p = readJSON<LastPackage>(PACKAGE_KEY);
    return p && p.key === key ? p : null;
  }, [key, jobId]);
  const check = useMemo(() => {
    const c = readJSON<AreaCheckNote>('bharat3d_area_check');
    return c && c.key === key ? c : null;
  }, [key]);
  const datasets = pkg?.datasets ?? [];

  // Local clock between polls, so the timer and the bar move every moment, not once a second.
  const polledAt = useRef({ elapsed: 0, at: Date.now() });
  const [now, setNow] = useState(Date.now());
  const shown = useRef(0);
  const [showAll, setShowAll] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: number | undefined;
    setJob(null);
    setPollError(null);
    setCountdown(null);
    shown.current = 0;
    const tick = async () => {
      try {
        const j = await getJob(jobId);
        if (!alive) return;
        polledAt.current = { elapsed: j.elapsed_s, at: Date.now() };
        setJob(j);
        setPollError(null);
        setLostContact(false);
        if (j.status === 'RUNNING') timer = window.setTimeout(tick, 1000);
      } catch (err: any) {
        if (!alive) return;
        if (err?.response?.status === 404) {
          setPollError('The server restarted and no longer knows this job. If the area was already built it will still open; otherwise start it again.');
        } else {
          setLostContact(true);
          timer = window.setTimeout(tick, 2500);
        }
      }
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  const running = job?.status === 'RUNNING';
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (job?.status === 'COMPLETE' || job?.status === 'FAILED') {
      const where = job.place?.locality ? `${job.place.locality}${job.place.city ? `, ${job.place.city}` : ''}` : 'a new area';
      if (job.status === 'FAILED') track({ kind: 'error', action: 'generation_failed', text: `could not generate ${where}: ${String(job.error || '').slice(0, 160)}`, detail: { key, error: job.error, kind: job.error_kind, detail: job.error_detail } }, true);
      else trackAction('generation_completed', `generated ${where} in ${Math.round(job.elapsed_s)} s: ${job.stats?.buildings ?? 0} buildings, ${job.stats?.vprids_reserved ?? 0} 3D ULPINs, ${job.stats?.violations ?? 0} findings`,
        { key, seconds: job.elapsed_s, stats: job.stats ? { buildings: job.stats.buildings, vprids: job.stats.vprids_reserved, findings: job.stats.violations, ai: job.stats.ai_buildings?.added } : null });
    }
    if (job?.status === 'COMPLETE') {
      const t = window.setTimeout(() => navigate(`/3d-world/${key}?project_id=${projectId}`), 1800);
      return () => window.clearTimeout(t);
    }
  }, [job?.status, key, projectId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => {
    if (!pkg?.polygon || retrying) return;
    setRetrying(true);
    setRetryError(null);
    setCountdown(null);
    try {
      const r = await startGeneration(pkg.polygon, projectId, false, datasets.length ? datasets : undefined);
      try {
        sessionStorage.setItem(PACKAGE_KEY, JSON.stringify({ ...pkg, key: r.key, retries: (pkg.retries ?? 0) + 1 }));
      } catch { /* display only */ }
      navigate(`/surveyor/generate?job=${r.job_id}&key=${r.key}&project_id=${projectId}`, { replace: true });
    } catch (e: any) {
      setRetryError(e?.response?.data?.detail || 'Could not restart yet: the server may still be waking up. Try again in a moment.');
    } finally {
      setRetrying(false);
    }
  };

  // "Map servers busy" restarts by itself once, with a visible countdown the user can cancel or skip.
  const failed = job?.status === 'FAILED';
  const autoRetry = failed && job?.error_kind === 'busy' && !!pkg?.polygon && (pkg?.retries ?? 0) < MAX_AUTO_RETRIES;
  useEffect(() => {
    if (autoRetry) setCountdown(AUTO_RETRY_S);
  }, [autoRetry, jobId]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      retry();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = job?.stages ?? [];
  const current = job?.stage_index ?? 0;
  const stats = job?.stats;
  const elapsed = running && !lostContact ? polledAt.current.elapsed + (now - polledAt.current.at) / 1000 : job?.elapsed_s ?? 0;
  const inStage = elapsed - (job?.stage_started_s ?? 0);

  let pct = 0;
  if (job?.status === 'COMPLETE') pct = 100;
  else if (failed) pct = overallProgress(current, stages.length, 0); // where it stopped
  else if (job) pct = overallProgress(current, stages.length, inStage, job.stage_progress ?? 0);
  if (job) shown.current = Math.max(shown.current, pct); // never moves backwards
  const bar = Math.max(shown.current, 2);

  // when each stage started, from the server's activity log
  const log = job?.log ?? [];
  const startedAt = useMemo(() => {
    const out: (number | null)[] = stages.map(() => null);
    for (const e of log) {
      if (e.kind !== 'stage') continue;
      const i = stages.findIndex((s) => e.msg === s || e.msg.startsWith(`${s} · `));
      if (i >= 0 && out[i] === null) out[i] = e.t;
    }
    return out;
  }, [log, stages]);
  const stageTime = (i: number): string | null => {
    const a = startedAt[i];
    if (a === null) return null;
    if (running && i === current) return `${Math.max(0, elapsed - a).toFixed(0)} s`;
    const b = startedAt.slice(i + 1).find((x) => x !== null) ?? (job?.status === 'COMPLETE' ? job.elapsed_s : null);
    return b === null || b === undefined ? null : `${Math.max(0.1, b - a).toFixed(1)} s`;
  };

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, showAll]);

  const thoughts = lostContact
    ? ['Reconnecting to the server…', 'The server may be busy or waking up; your area keeps building there…']
    : log[log.length - 1]?.kind === 'retry'
      ? ['Waiting a few seconds before asking the map servers again…', 'Lining up other OpenStreetMap servers…']
      : STAGE_THOUGHTS[current] ?? [`${job?.stage ?? 'Working'}…`];
  const visibleLog = showAll ? log : log.slice(-6);
  const kind = job?.error_kind ?? (failed ? 'internal' : null);

  return (
    <div className="flex-1 min-h-screen bg-[#f3efe6] b3-app flex flex-col items-center justify-center p-6 gap-5">
      <SurveySteps current={job?.status === 'COMPLETE' ? 4 : 3} className="b3-rise" />
      <div className="w-full max-w-3xl b3-card p-8 space-y-6 b3-rise b3-d1">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="b3-eyebrow">{job?.status === 'COMPLETE' ? '3D record ready' : failed ? 'Generation stopped' : 'Reconstructing the 3D record'}</div>
            <h1 className="b3-serif text-3xl mt-2 text-[#1b3344] leading-tight">
              {job?.place?.locality ? `${job.place.locality}${job.place.city ? `, ${job.place.city}` : ''}` : pkg?.place || 'Reading the ground'}
            </h1>
            <p className="text-sm text-[#5c6e7c] mt-1.5">
              {job ? <>{(job.area_m2 / 1e6).toFixed(3)} km² · <span className="b3-num font-mono">{clock(elapsed)}</span> elapsed
                {check?.eta_s && running ? <> · usually {durationText(check.eta_s)}{check.buildings ? ` for ${check.buildings.toLocaleString('en-IN')} buildings` : ''}</> : null}
                {(job.attempt ?? 1) > 1 && running ? <> · attempt {job.attempt}</> : null}</> : 'Connecting to the generator…'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`b3-serif text-5xl leading-none ${failed ? 'text-[#c0392b]' : 'text-[#1f7a72]'}`}>
              {job?.status === 'COMPLETE' ? <CountUp value={100} /> : Math.floor(bar)}%
            </div>
            <div className="text-[10px] text-[#7d8c97] font-mono mt-1">area {key}</div>
          </div>
        </div>

        <div className="h-1.5 bg-[#e4dccf] rounded-full overflow-hidden">
          <div className={`relative h-full rounded-full overflow-hidden transition-[width] duration-300 ease-linear ${failed ? 'bg-[#c0392b]' : 'bg-gradient-to-r from-[#1e4d6b] to-[#1f7a72]'}`}
            style={{ width: `${job?.status === 'COMPLETE' ? 100 : bar}%` }}>
            {running && <span className="absolute inset-0 b3-shimmer" />}
          </div>
        </div>

        {running && (
          <div className="space-y-1.5 -mt-2">
            <Thinking messages={thoughts} className="text-[15px] font-medium" />
            {job?.detail && !lostContact && <p key={job.detail} className="text-xs text-[#7d8c97] font-mono truncate pl-[18px] b3-log-in">› {job.detail}</p>}
          </div>
        )}

        {!job && !pollError ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <StrataLoader title="Starting the pipeline" />
            <Thinking messages={lostContact ? thoughts : ['Connecting to the generator…', 'Waking the server if it was asleep…', 'Queuing your area…']} hold className="text-sm" />
          </div>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm b3-stagger">
            {stages.map((s, i) => {
              const done = job?.status === 'COMPLETE' || i < current;
              const active = running && i === current;
              const bad = failed && i === current;
              const t = done || active ? stageTime(i) : null;
              return (
                <li key={s} className={`flex items-center gap-2.5 transition-colors duration-500 ${done ? 'text-[#1b3344]' : active ? 'text-[#1f7a72] font-semibold' : bad ? 'text-[#c0392b]' : 'text-[#9aa6ae]'}`}>
                  {bad ? <XCircle className="w-4 h-4 text-[#c0392b] shrink-0" /> : done ? <CheckCircle2 className="w-4 h-4 text-[#1f7a72] shrink-0 b3-pop" />
                    : active ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                  <span className="truncate flex-1">{s}</span>
                  {t && <span className={`text-[10.5px] font-mono shrink-0 ${active ? 'text-[#1f7a72]' : 'text-[#9aa6ae]'}`}>{t}</span>}
                </li>
              );
            })}
          </ol>
        )}

        {log.length > 0 && (
          <div className="b3-well p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c] flex items-center gap-2">
                {running && <span className="w-1.5 h-1.5 rounded-full bg-[#1f7a72] b3-breathe" />} Live activity · {log.length} events
              </div>
              {log.length > 6 && (
                <button className="text-[11px] text-[#1f7a72] hover:underline" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show latest' : 'Show all'}</button>
              )}
            </div>
            <ol ref={logRef} className={`space-y-1 text-[11.5px] ${showAll ? 'max-h-56 overflow-y-auto b3-scroll pr-1' : ''}`}>
              {visibleLog.map((e, i) => (
                <li key={`${e.t}-${i}-${e.msg}`} className="flex items-start gap-2 b3-log-in">
                  <span className="font-mono text-[#9aa6ae] w-9 shrink-0 text-right">{clock(e.t)}</span>
                  <span className={`w-1.5 h-1.5 rounded-full mt-[5px] shrink-0 ${LOG_DOT[e.kind] ?? LOG_DOT.note}`} />
                  <span className={`min-w-0 ${e.kind === 'stage' || e.kind === 'done' ? 'text-[#1b3344]' : e.kind === 'error' ? 'text-[#c0392b]' : e.kind === 'retry' ? 'text-[#8a5a12]' : 'text-[#5c6e7c]'}`}>{e.msg}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {datasets.length > 0 && (
          <div className="b3-well p-3 b3-fade">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c] mb-2">Survey package · {datasets.length} datasets attached to this area</div>
            <div className="flex flex-wrap gap-1.5 b3-stagger">
              {datasets.map((d) => (
                <span key={d.slot} className="b3-chip b3-chip-real" title={d.name}>{d.title} · {fmtBytes(d.size_bytes)}</span>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center b3-stagger">
            {[
              ['Buildings', stats.buildings], ['Floors', stats.floors], ['3D ULPINs', stats.vprids_reserved ?? stats.volumetric_units],
              ['Roads', stats.roads], ['Subsurface', stats.subsurface_assets], ['Findings', stats.violations],
            ].map(([label, v]) => (
              <div key={label as string} className="b3-well py-2.5">
                <CountUp value={Number(v) || 0} className="block text-xl font-bold text-[#1b3344]" />
                <div className="text-[10px] uppercase tracking-wider text-[#5c6e7c]">{label}</div>
              </div>
            ))}
          </div>
        )}

        {job?.summary && <p className="text-[15px] text-[#33495a] leading-relaxed b3-fade">{job.summary}</p>}

        {failed && (
          <div className={`rounded-xl p-4 b3-pop border ${kind === 'busy' ? 'bg-[#c8962e]/10 border-[#c8962e]/35' : 'bg-[#c0392b]/6 border-[#c0392b]/25'}`}>
            <div className="flex gap-3">
              {kind === 'busy' ? <CloudOff className="w-5 h-5 text-[#8a5a12] shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-[#c0392b] shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`font-semibold ${kind === 'busy' ? 'text-[#8a5a12]' : 'text-[#c0392b]'}`}>
                  {kind === 'busy' ? 'The public map servers are busy right now' : kind === 'area' ? 'This area cannot be generated' : 'Something went wrong while building this area'}
                </div>
                <p className="text-sm text-[#33495a] leading-relaxed">
                  {kind === 'internal' ? 'The generator stopped unexpectedly. Trying again usually works; if it keeps failing, choose a slightly different area.' : job?.error}
                </p>
                {countdown !== null && (
                  <p className="text-sm text-[#1b3344]">
                    Trying again automatically in <b className="font-mono">{countdown}</b> s…{' '}
                    <button className="text-[#1f7a72] hover:underline" onClick={() => setCountdown(null)}>Cancel</button>
                  </p>
                )}
                {retryError && <p className="text-sm text-[#c0392b]">{retryError}</p>}
                {(job?.error_detail || kind === 'internal') && (
                  <div>
                    <button className="text-[11px] text-[#5c6e7c] hover:text-[#1b3344] flex items-center gap-1" onClick={() => setDetailsOpen((v) => !v)}>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} /> Technical details
                    </button>
                    {detailsOpen && <pre className="mt-1.5 text-[10.5px] text-[#5c6e7c] whitespace-pre-wrap break-words font-mono b3-expand">{job?.error_detail || job?.error}</pre>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {pollError && !failed && (
          <div className="text-sm text-[#8a5a12] bg-[#c8962e]/10 border border-[#c8962e]/35 rounded-xl p-3 b3-pop">{pollError}</div>
        )}

        <div className="flex justify-between gap-3 pt-1 flex-wrap">
          <button className="b3-btn" onClick={() => navigate(`/surveyor/area?project_id=${projectId}`)}>
            <RotateCcw className="w-4 h-4" /> Choose another area
          </button>
          <div className="flex gap-2">
            {((failed && kind !== 'area') || pollError) && pkg?.polygon && (
              <button className="b3-btn b3-btn-primary" disabled={retrying} onClick={retry}>
                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {countdown !== null ? 'Try again now' : 'Try again'}
              </button>
            )}
            <button className="b3-btn b3-btn-teal" disabled={job?.status !== 'COMPLETE' && !pollError}
              onClick={() => navigate(`/3d-world/${key}?project_id=${projectId}`)}>
              <Box className="w-4 h-4" /> Enter the 3D world <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {running && (
          <p className="text-[11px] text-[#9aa6ae] text-center -mt-2">The model is built on the server, so reloading this page does not stop it. Areas that have been built once open instantly.</p>
        )}
      </div>
    </div>
  );
};

export default GenerationPage;
