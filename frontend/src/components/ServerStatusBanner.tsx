import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, Server, X } from 'lucide-react';
import { retryWake, secondsLeft, useServerStatus } from '../lib/serverStatus';
import { Thinking } from '../survey/Thinking';

const STEPS = [
  'Starting the server…',
  'Loading the 3D engine…',
  'Restoring surveyed areas from storage…',
  'Opening the property registry…',
  'Almost ready…',
];

/** Centred at the top with a 12 px gutter on phones. Positioning lives here, not on the animated element, because the
 *  pop-in animation sets `transform` and would cancel a translate-based centring. */
const Shell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="fixed inset-x-0 top-3 z-[1000] flex justify-center px-3 pointer-events-none" role="status" aria-live="polite">
    <div className={`pointer-events-auto b3-pop ${wide ? 'w-full max-w-[440px]' : ''}`}>{children}</div>
  </div>
);

/**
 * Shown while the free API server wakes up. A small pill when nobody is waiting; a card with a countdown when an
 * action (sign-in, opening an area, generating) is waiting. The page stays usable underneath, and the waiting action
 * continues by itself when the server answers.
 */
export const ServerStatusBanner: React.FC = () => {
  const s = useServerStatus();
  const [now, setNow] = useState(Date.now());
  const [hidden, setHidden] = useState(false);
  const [showReady, setShowReady] = useState(false);

  const active = s.state === 'waking' || s.state === 'down';
  useEffect(() => {
    if (!active) return;
    setHidden(false);
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (!s.readyAt) return;
    setShowReady(true);
    const t = window.setTimeout(() => setShowReady(false), s.readyAfterDown ? 6000 : 2200);
    return () => window.clearTimeout(t);
  }, [s.readyAt]);

  if (!active && !showReady) return null;

  if (!active && showReady) {
    return (
      <Shell>
        <div className="flex items-center gap-2 rounded-full bg-[#15803D] text-white text-[12.5px] font-semibold px-4 py-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4" /> {s.readyAfterDown ? 'The server is back — please try again' : 'Server ready — continuing'}
        </div>
      </Shell>
    );
  }

  const left = secondsLeft(s, now);
  const total = Math.max(s.estimateS, 1);
  const elapsed = s.since ? (now - s.since) / 1000 : 0;
  const pct = Math.min(96, (elapsed / total) * 100);
  const overtime = left <= 0;
  const longOvertime = left < -30; // well past the usual time: say so honestly instead of "almost there"
  const down = s.state === 'down';
  const expanded = (s.waiting > 0 || down) && !hidden;
  const countdown = overtime ? 'a few more seconds' : `about ${Math.ceil(left)} s`;

  if (!expanded) {
    return (
      <Shell>
        <button onClick={() => setHidden(false)} title="The server is waking up"
          className="flex items-center gap-2.5 rounded-full bg-[#0B2545]/95 text-white text-[12px] pl-3 pr-4 py-1.5 shadow-lg backdrop-blur">
          <span className="b3-think-dot" style={{ background: '#F2C46A' }} aria-hidden />
          <span>Starting the server · {countdown}</span>
          <span className="w-16 h-1 rounded-full bg-white/20 overflow-hidden">
            <span className="block h-full bg-[#F2C46A] transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
          </span>
        </button>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div className={`rounded-2xl shadow-2xl border overflow-hidden ${down ? 'bg-[#FEF2F2] border-[#FCA5A5]' : 'bg-white border-[#E4DCCF]'}`}>
        <div className="p-4 flex gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${down ? 'bg-[#B91C1C]/10 text-[#B91C1C]' : 'bg-[#1F7A72]/10 text-[#1F7A72]'}`}>
            {down ? <CloudOff className="w-5 h-5" /> : <Server className="w-5 h-5 b3-breathe" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-[14px] text-[#0B2545]">
                {down ? 'The server is not responding' : longOvertime ? 'Taking longer than usual' : overtime ? 'Almost there…' : 'Waking up the server'}
              </div>
              <button onClick={() => setHidden(true)} className="text-[#94A3B8] hover:text-[#334155] -mt-0.5" aria-label="Hide">
                <X className="w-4 h-4" />
              </button>
            </div>
            {down ? (
              <p className="text-[12.5px] text-[#7F1D1D] mt-1 leading-relaxed">
                It did not start in time, so the last action was stopped. We keep checking in the background and will
                show a message when it is back. You can also press Try again.
              </p>
            ) : longOvertime ? (
              <p className="text-[12.5px] text-[#475569] mt-1 leading-relaxed">
                The free server is slower to start than usual today. <b>Your request is still waiting</b> and will
                continue by itself — no need to click again.
              </p>
            ) : (
              <p className="text-[12.5px] text-[#475569] mt-1 leading-relaxed">
                BHARAT 3D runs on a free server that sleeps when nobody is using it. It is starting now and
                <b> your request will continue by itself</b> — no need to click again.
              </p>
            )}
            {!down && (
              <>
                <div className="flex items-baseline justify-between mt-3">
                  <Thinking messages={overtime ? ['Taking a little longer than usual…', 'Still starting — hang on…'] : STEPS} every={3200} className="text-[12px]" />
                  <span className="font-mono text-[13px] font-semibold text-[#0B2545] shrink-0 ml-2">
                    {overtime ? `+${Math.floor(-left)} s` : `${Math.ceil(left)} s`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E4DCCF] mt-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${overtime ? 'bg-[#C8962E] b3-shimmer' : 'bg-gradient-to-r from-[#1E4D6B] to-[#1F7A72]'}`}
                    style={{ width: `${overtime ? 100 : pct}%` }} />
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-1.5">Usually takes about {Math.round(s.estimateS)} seconds · after that everything is fast</div>
              </>
            )}
            {down && (
              <button className="b3-btn b3-btn-primary mt-3 !py-1.5" onClick={() => { retryWake(); }}>
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default ServerStatusBanner;
