import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { CalendarClock, CheckCircle2, Clock3, CloudOff, RefreshCw, Server, X } from 'lucide-react';
import { checkNow, comeBack, isLimited, secondsLeft, useServerStatus } from '../lib/serverStatus';
import { Thinking } from '../survey/Thinking';

const STEPS = [
  'Starting the server…',
  'Loading the 3D engine…',
  'Restoring surveyed areas from storage…',
  'Opening the property registry…',
  'Almost ready…',
];

/**
 * Pages where the banner never shows: reading pages wake the server silently in the background, and the sign-in page
 * shows the same status inside its form, where it cannot cover anything.
 */
const QUIET_PATHS = /^\/(?:$|welcome$|privacy$|terms$|login$)/;

/** Whether the banner is on screen, so other overlays (tips) can wait for it instead of stacking on top of it. */
export const useServerBannerShowing = create<{ showing: boolean }>(() => ({ showing: false }));

/** Bottom centre, with a 12 px gutter on phones: the usual place for background status, away from page headings. */
const Shell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="fixed inset-x-0 bottom-3 sm:bottom-5 z-[1000] flex justify-center px-3 pointer-events-none" role="status" aria-live="polite">
    <div className={`pointer-events-auto b3-pop ${wide ? 'w-full max-w-[440px]' : ''}`}>{children}</div>
  </div>
);

/**
 * Shown while the free API server wakes up: a small pill when nobody is waiting, a card with a countdown when an
 * action (opening an area, generating, saving) is waiting; the waiting action continues by itself when the server
 * answers. When the server cannot be used for a while (it did not start, too much traffic, or a free monthly limit),
 * a card says so in plain words with the estimated time to come back, and the page keeps checking in the background.
 */
export const ServerStatusBanner: React.FC = () => {
  const s = useServerStatus();
  const { pathname } = useLocation();
  const quiet = QUIET_PATHS.test(pathname);
  const [now, setNow] = useState(Date.now());
  const [hidden, setHidden] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [checking, setChecking] = useState(false);

  const stopped = s.state === 'down' || isLimited(s.state);
  const active = s.state === 'waking' || stopped;
  useEffect(() => {
    if (!active) return;
    setHidden(false);
    setNow(Date.now()); // the clock may be stale from before this state began
    const t = window.setInterval(() => setNow(Date.now()), stopped ? 15_000 : 250);
    return () => window.clearInterval(t);
  }, [active, stopped, s.state]);

  useEffect(() => {
    if (!s.readyAt) return;
    setShowReady(true);
    const t = window.setTimeout(() => setShowReady(false), s.readyAfterDown ? 6000 : 2200);
    return () => window.clearTimeout(t);
  }, [s.readyAt]);

  const visible = !quiet && (active || showReady);
  useEffect(() => {
    if (useServerBannerShowing.getState().showing !== visible) useServerBannerShowing.setState({ showing: visible });
  }, [visible]);
  useEffect(() => () => useServerBannerShowing.setState({ showing: false }), []);

  if (!visible) return null;

  if (!active && showReady) {
    return (
      <Shell>
        <div className="flex items-center gap-2 rounded-full bg-[#15803D] text-white text-[12.5px] font-semibold px-4 py-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4" /> {s.readyAfterDown ? 'The server is back. Please try again.' : 'Server ready, continuing'}
        </div>
      </Shell>
    );
  }

  // ------------------------------------------------------------------ cannot be used for a while: when to come back
  if (stopped) {
    const when = s.retryAt ? comeBack(s.retryAt, now) : 'in a few minutes';
    const monthly = s.state === 'suspended';
    const title = monthly ? 'BHARAT 3D has reached its free monthly limit'
      : s.state === 'busy' ? 'BHARAT 3D is getting too much traffic right now'
        : 'The server is overloaded right now';
    const reason = monthly ? 'The free server has used up this month’s hours, so the host has paused it.'
      : s.state === 'busy' ? 'Too many requests reached the free server at once, so it has paused new ones for a while.'
        : 'The free server did not start in time (the host is overloaded). Your last action was stopped.';
    const minsLeft = s.retryAt ? Math.max(0, Math.ceil((s.retryAt - now) / 60_000)) : null;
    if (hidden) {
      return (
        <Shell>
          <button type="button" onClick={() => setHidden(false)} className="flex items-center gap-2 rounded-full bg-[#7F1D1D] text-white text-[12px] pl-3 pr-4 py-1.5 shadow-lg">
            <Clock3 className="w-3.5 h-3.5" /> Server busy · come back {when.replace(/ \(.*\)$/, '')}
          </button>
        </Shell>
      );
    }
    return (
      <Shell wide>
        <div className="rounded-2xl shadow-2xl border overflow-hidden bg-[#FFF7ED] border-[#FDBA74]">
          <div className="p-4 flex gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#C2410C]/10 text-[#C2410C]">
              {monthly ? <CalendarClock className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-[14px] text-[#7C2D12]">{title}</div>
                <button type="button" onClick={() => setHidden(true)} className="text-[#C2410C]/60 hover:text-[#7C2D12] -mt-0.5" aria-label="Make this message smaller">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[12.5px] text-[#7C2D12]/90 mt-1 leading-relaxed">{reason}</p>
              <div className="mt-3 rounded-xl bg-white/80 border border-[#FED7AA] px-3 py-2.5 flex items-center gap-3">
                <Clock3 className="w-5 h-5 text-[#C2410C] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#7C2D12]">Please come back {when}</div>
                  <div className="text-[11.5px] text-[#9A3412]/80">Your work is safe. This page keeps checking and will tell you when it is ready.</div>
                </div>
                {minsLeft !== null && minsLeft < 90 && (
                  <div className="ml-auto text-right shrink-0">
                    <div className="font-mono text-[18px] font-bold text-[#C2410C] leading-none">{minsLeft}</div>
                    <div className="text-[10px] text-[#9A3412]/70 uppercase tracking-wide">min</div>
                  </div>
                )}
              </div>
              <button type="button" className="b3-btn mt-3 !py-1.5 !bg-white" disabled={checking}
                onClick={async () => { setChecking(true); try { await checkNow(); } finally { setChecking(false); setNow(Date.now()); } }}>
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> {checking ? 'Checking…' : 'Check now'}
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ----------------------------------------------------------------------------------------- waking up: countdown
  const left = secondsLeft(s, now);
  const total = Math.max(s.estimateS, 1);
  const elapsed = s.since ? (now - s.since) / 1000 : 0;
  const pct = Math.min(96, (elapsed / total) * 100);
  const overtime = left <= 0;
  const longOvertime = left < -30; // well past the usual time: say so honestly instead of "almost there"
  const expanded = s.waiting > 0 && !hidden;
  const countdown = overtime ? 'a few more seconds' : `about ${Math.ceil(left)} s`;

  if (!expanded) {
    return (
      <Shell>
        <button type="button" onClick={() => setHidden(false)} title="The server is waking up"
          className="flex items-center gap-2.5 rounded-full bg-[#0B2545]/95 text-white text-[12px] pl-3 pr-4 py-1.5 shadow-lg backdrop-blur">
          <span className="b3-think-dot" style={{ background: '#F2C46A' }} aria-hidden />
          <span>Starting the server · {countdown}</span>
          <span className="w-16 h-1 rounded-full bg-white/20 overflow-hidden" aria-hidden>
            <span className="block h-full bg-[#F2C46A] transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
          </span>
        </button>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className="rounded-2xl shadow-2xl border overflow-hidden bg-white border-[#E4DCCF]">
        <div className="p-4 flex gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#1F7A72]/10 text-[#1F7A72]">
            <Server className="w-5 h-5 b3-breathe" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-[14px] text-[#0B2545]">
                {longOvertime ? 'Taking longer than usual' : overtime ? 'Almost there…' : 'Waking up the server'}
              </div>
              <button type="button" onClick={() => setHidden(true)} className="text-[#94A3B8] hover:text-[#334155] -mt-0.5" aria-label="Make this message smaller">
                <X className="w-4 h-4" />
              </button>
            </div>
            {longOvertime ? (
              <p className="text-[12.5px] text-[#475569] mt-1 leading-relaxed">
                The free server is slower to start than usual today. <b>Your request is still waiting</b> and will
                continue by itself, no need to click again.
              </p>
            ) : (
              <p className="text-[12.5px] text-[#475569] mt-1 leading-relaxed">
                BHARAT 3D runs on a free server that sleeps when nobody is using it. It is starting now and
                <b> your request will continue by itself</b>, no need to click again.
              </p>
            )}
            <div className="flex items-baseline justify-between mt-3">
              <Thinking messages={overtime ? ['Taking a little longer than usual…', 'Still starting, hang on…'] : STEPS} every={3200} className="text-[12px]" />
              <span className="font-mono text-[13px] font-semibold text-[#0B2545] shrink-0 ml-2">
                {overtime ? `+${Math.floor(-left)} s` : `${Math.ceil(left)} s`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#E4DCCF] mt-2 overflow-hidden">
              <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${overtime ? 'bg-[#C8962E] b3-shimmer' : 'bg-gradient-to-r from-[#1E4D6B] to-[#1F7A72]'}`}
                style={{ width: `${overtime ? 100 : pct}%` }} />
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-1.5">Usually takes about {Math.round(s.estimateS)} seconds · after that everything is fast</div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default ServerStatusBanner;
