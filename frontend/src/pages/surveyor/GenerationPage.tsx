import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Loader2, XCircle, Box, ArrowRight, RotateCcw } from 'lucide-react';
import { getJob } from '../../world/api';
import type { GenerationJob } from '../../world/sceneSpec';
import { CountUp, StrataLoader } from '../../world/ui';
import { SurveySteps } from '../../survey/Steps';
import { fmtBytes } from '../../survey/datasets';
import type { DatasetManifest } from '../../world/sceneSpec';

const readPackage = (key: string): DatasetManifest[] => {
  try {
    const p = JSON.parse(sessionStorage.getItem('bharat3d_last_package') || 'null');
    return p && p.key === key ? p.datasets : [];
  } catch {
    return [];
  }
};

export const GenerationPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get('job') || '';
  const key = params.get('key') || '';
  const projectId = params.get('project_id') || 'proj-001';
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pkg] = useState(() => readPackage(key));

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const j = await getJob(jobId);
        if (!alive) return;
        setJob(j);
        setPollError(null);
        if (j.status === 'RUNNING') timer = window.setTimeout(tick, 1000);
      } catch (err: any) {
        if (!alive) return;
        if (err?.response?.status === 404) {
          setPollError('This generation job is no longer known to the server (it may have restarted). If the area was already built it will still open.');
        } else {
          setPollError('Lost contact with the API, retrying…');
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

  useEffect(() => {
    if (job?.status === 'COMPLETE') {
      const t = window.setTimeout(() => navigate(`/3d-world/${key}?project_id=${projectId}`), 1800);
      return () => window.clearTimeout(t);
    }
  }, [job?.status, key, projectId, navigate]);

  const stages = job?.stages ?? [];
  const current = job?.stage_index ?? 0;
  const stats = job?.stats;
  const failed = job?.status === 'FAILED';

  return (
    <div className="flex-1 min-h-screen bg-[#f3efe6] b3-app flex flex-col items-center justify-center p-6 gap-5">
      <SurveySteps current={job?.status === 'COMPLETE' ? 4 : 3} className="b3-rise" />
      <div className="w-full max-w-3xl b3-card p-8 space-y-6 b3-rise b3-d1">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="b3-eyebrow">{job?.status === 'COMPLETE' ? '3D record ready' : 'Reconstructing the 3D record'}</div>
            <h1 className="b3-serif text-3xl mt-2 text-[#1b3344] leading-tight">
              {job?.place?.locality ? `${job.place.locality}${job.place.city ? `, ${job.place.city}` : ''}` : 'Reading the ground'}
            </h1>
            <p className="text-sm text-[#5c6e7c] mt-1.5">
              {job ? <>{(job.area_m2 / 1e6).toFixed(3)} km² · <span className="b3-num">{job.elapsed_s.toFixed(0)}</span> s elapsed · real open data, nothing pre-loaded</> : 'Connecting to the generator…'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="b3-serif text-5xl text-[#1f7a72] leading-none"><CountUp value={job?.progress ?? 0} />%</div>
            <div className="text-[10px] text-[#7d8c97] font-mono mt-1">area {key}</div>
          </div>
        </div>

        <div className="h-1.5 bg-[#e4dccf] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${failed ? 'bg-[#c0392b]' : 'bg-gradient-to-r from-[#1e4d6b] to-[#1f7a72]'} ${job?.status === 'RUNNING' ? 'b3-shimmer' : ''}`}
            style={{ width: `${Math.max(job?.progress ?? 2, 2)}%` }} />
        </div>

        {!job && !pollError ? (
          <div className="py-8 flex justify-center"><StrataLoader title="Starting the pipeline" /></div>
        ) : (
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm b3-stagger">
            {stages.map((s, i) => {
              const done = job?.status === 'COMPLETE' || i < current;
              const active = job?.status === 'RUNNING' && i === current;
              const bad = failed && i === current;
              return (
                <li key={s} className={`flex items-center gap-2.5 transition-colors duration-500 ${done ? 'text-[#1b3344]' : active ? 'text-[#1f7a72] font-semibold' : 'text-[#9aa6ae]'}`}>
                  {bad ? <XCircle className="w-4 h-4 text-[#c0392b] shrink-0" /> : done ? <CheckCircle2 className="w-4 h-4 text-[#1f7a72] shrink-0 b3-pop" />
                    : active ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{s}</span>
                </li>
              );
            })}
          </ol>
        )}

        {pkg.length > 0 && (
          <div className="b3-well p-3 b3-fade">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c] mb-2">Survey package · {pkg.length} datasets attached to this area</div>
            <div className="flex flex-wrap gap-1.5 b3-stagger">
              {pkg.map((d) => (
                <span key={d.slot} className="b3-chip b3-chip-real" title={d.name}>{d.title} · {fmtBytes(d.size_bytes)}</span>
              ))}
            </div>
          </div>
        )}

        {job?.status === 'RUNNING' && job.detail && <p className="text-xs text-[#7d8c97] font-mono truncate b3-breathe">› {job.detail}</p>}

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

        {(failed || pollError) && (
          <div className="text-sm text-[#c0392b] bg-[#c0392b]/8 border border-[#c0392b]/25 rounded-xl p-3 b3-pop">{job?.error || pollError}</div>
        )}

        <div className="flex justify-between gap-3 pt-1">
          <button className="b3-btn" onClick={() => navigate(`/surveyor/area?project_id=${projectId}`)}>
            <RotateCcw className="w-4 h-4" /> Choose another area
          </button>
          <button className="b3-btn b3-btn-teal" disabled={job?.status !== 'COMPLETE' && !pollError}
            onClick={() => navigate(`/3d-world/${key}?project_id=${projectId}`)}>
            <Box className="w-4 h-4" /> Enter the 3D world <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerationPage;
