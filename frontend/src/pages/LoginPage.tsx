import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, CloudOff, Info, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { BrandLogo } from '../components/layout/BrandLogo';
import { checkNow, comeBack, ensureAwake, isLimited, limitMessage, limitTitle, useServerStatus, wakeClock, wakeCopy } from '../lib/serverStatus';
import { OFFLINE, OFFLINE_MESSAGE, SERVER_BUSY } from '../lib/api';
import { ROLE_LABEL, allowedPath, homeFor, safeNext } from '../lib/roles';
import type { LoginState } from '../components/ProtectedRoute';
import { resetTips } from '../components/coach/CoachMark';
import { Thinking } from '../survey/Thinking';

const DEMO_PASSWORD = 'demo2026'; // the shared review password, shown on this page for evaluators

const personas = [
  { email: 'survey@bharat3d.demo', title: 'Surveyor', detail: 'Confirm volumes and save identities' },
  { email: 'municipality@bharat3d.demo', title: 'Municipality', detail: 'Height, setback, and encroachment' },
  { email: 'utility@bharat3d.demo', title: 'Utility operator', detail: 'Excavation against subsurface assets' },
  { email: 'citizen@bharat3d.demo', title: 'Citizen', detail: 'Your unit and its parent parcel' },
];

/** A sign-in that failed only because the server was not reachable yet is sent again by itself, up to this often. */
const MAX_AUTO_CONTINUE = 5;
const OFFLINE_SIGN_IN = 'You are offline. You will be signed in automatically as soon as your internet connection is back.';

/** A plain-English message for a failed sign-in. */
function signInError(err: any): string {
  const status = err?.response?.status;
  const st = useServerStatus.getState();
  if (err?.code === OFFLINE) return OFFLINE_MESSAGE;
  if (err?.code === SERVER_BUSY || status === 429 || isLimited(st.state)) return limitMessage(st);
  if (status === 401) return 'That email and password do not match. Choose a workspace below: every demo account uses the same password.';
  if (status === 422) return 'Enter a full email address, for example survey@bharat3d.demo.';
  if (!err?.response || status >= 500) return 'The server did not answer. Please press Sign in again in a moment.';
  const detail = err?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : 'Sign-in did not work. Please try again.';
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, isLoading, isAuthenticated, user, signedOutReason } = useAuthStore();
  const server = useServerStatus();
  const [email, setEmail] = useState('survey@bharat3d.demo');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [, tick] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // A sign-in stopped by a free-plan limit continues by itself when the limit is over.
  const resumeRef = useRef(false);
  const [resumePending, setResumePending] = useState(false);
  const [backNote, setBackNote] = useState<string | null>(null);
  // A sign-in that failed only because the server or the connection was not there yet goes again by itself.
  const autoTries = useRef(0);
  const [continuing, setContinuing] = useState(false);
  const [offlineWait, setOfflineWait] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Where to go after signing in: the page the visitor opened (route guard), or a ?next= link.
  const from = safeNext((location.state as LoginState | null)?.from) ?? safeNext(new URLSearchParams(location.search).get('next'));

  const waking = server.state === 'waking';
  const stopped = isLimited(server.state);
  const busy = isLoading || continuing;
  useEffect(() => { // keep the countdown moving while the server wakes
    if (!waking) return;
    const t = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [waking]);
  useEffect(() => { // a sign-in that takes long on a slow connection (not a sleeping server) says so honestly
    if (!isLoading) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  useEffect(() => { // offline: sign in by itself as soon as the connection is back
    if (!offlineWait) return;
    const back = () => {
      setOfflineWait(false);
      setError('');
      formRef.current?.requestSubmit();
    };
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [offlineWait]);

  useEffect(() => { // the server answers again: continue a sign-in a limit stopped, or say it is back
    if (!server.readyAt) return;
    if (resumeRef.current) { // also after "Check now", which goes through a normal wake-up first
      resumeRef.current = false;
      setResumePending(false);
      setError('');
      setBackNote('The server is back. Signing you in…');
      formRef.current?.requestSubmit();
    } else if (server.readyAfterLimit) {
      setError('');
      setBackNote('The server is back. You can sign in now.');
    } else {
      return;
    }
    const t = window.setTimeout(() => setBackNote(null), 6000);
    return () => window.clearTimeout(t);
  }, [server.readyAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // the panel says "offline" while the device has no connection, not "the server is slow"
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const clock = wakeClock(server);
  const copy = wakeCopy(clock.round, clock.elapsed, true);
  // Before the visitor presses Sign in nothing is waiting yet, so the words say what will happen when they do.
  const note = !online ? 'Your device is offline. The wait continues as soon as your internet connection is back.'
    : busy ? copy.note
      : clock.round === 0
        ? 'The free server is starting (it sleeps when nobody is using it, and starting takes about a minute). You can press Sign in now: it continues by itself.'
        : 'The free server is still starting, a little slower than usual. You can press Sign in now: it continues by itself.';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || continuing) return;
    setError('');
    setOfflineWait(false);
    try {
      const signedIn = await login(email, password);
      autoTries.current = 0;
      resetTips(); // a new sign-in shows the tips again
      navigate(from ? allowedPath(signedIn.role, from) : homeFor(signedIn.role), { replace: true });
    } catch (err: any) {
      if (!mounted.current) return;
      const st = useServerStatus.getState().state;
      if (err?.code === OFFLINE) { // no connection on this device: wait for it, then sign in by itself
        setError(OFFLINE_SIGN_IN);
        setOfflineWait(true);
        return;
      }
      if (isLimited(st)) {
        // The orange card below explains the limit and when to come back; the sign-in resumes when it is over.
        resumeRef.current = true;
        setResumePending(true);
        return;
      }
      const status = err?.response?.status;
      const notReached = !err?.response || status === 502 || status === 503 || status === 504;
      if (notReached && autoTries.current < MAX_AUTO_CONTINUE) {
        // The server was not reachable yet: wait for it (the countdown shows), then sign in again by itself.
        autoTries.current += 1;
        setContinuing(true);
        let awake = false;
        try {
          awake = await ensureAwake(Date.now());
          // a short, growing pause, so a server that answers its health check but fails sign-ins is not flooded
          if (awake) await new Promise((r) => window.setTimeout(r, 1500 * autoTries.current));
        } finally { if (mounted.current) setContinuing(false); }
        if (!mounted.current) return;
        if (awake) {
          formRef.current?.requestSubmit();
          return;
        }
        resumeRef.current = true; // a limit was reached meanwhile: its card explains, and the sign-in resumes after it
        setResumePending(true);
        return;
      }
      autoTries.current = 0;
      setError(signInError(err));
      if (status === 401) {
        window.setTimeout(() => passwordRef.current?.select(), 0);
      }
    }
  };

  const buttonText = !busy ? 'Sign in'
    : !online ? 'Waiting for your connection…'
    : waking ? `${copy.button} ${clock.left} s`
      : continuing ? 'Signing in again…' : slow ? 'Still signing in…' : 'Signing in…';

  return (
    <div className="public-shell min-h-screen lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="bg-[#1e4d6b] text-[#e7eef2] px-6 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-12 flex flex-col">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left w-fit">
          <BrandLogo className="h-10 w-10" />
          <span className="text-sm font-semibold tracking-wide text-[#f3efe6]">BHARAT 3D</span>
        </button>
        <div className="mt-6 sm:mt-10 lg:mt-16 max-w-md">
          <p className="hidden sm:block text-[#8fd0c8] text-sm font-semibold">BHARAT 3D</p>
          <h1 className="sm:mt-3 text-2xl sm:text-4xl leading-tight text-white font-serif">
            A 3D land registry for Indian cities
          </h1>
          <p className="mt-2 sm:mt-3 text-base sm:text-lg text-[#d5e3ea] font-serif font-semibold">
            One ground number is not enough
          </p>
          <p className="hidden sm:block mt-4 text-[16px] leading-7 text-[#d5e3ea]">
            The 14-digit ULPIN stays the parent parcel. Child identities cover flats, basements, air-rights, and metro segments—with height in metres—after a surveyor confirms each volume.
          </p>
        </div>
        <div className="hidden sm:block mt-8 lg:mt-auto bg-[#173e56] border border-[#2d6484] rounded-sm p-4 max-w-md">
          <div className="text-xs uppercase tracking-wide text-[#8fd0c8]">Example</div>
          <div className="mt-2 text-[15px] text-white font-medium">48291503726481-F08-U804</div>
          <div className="mt-1 text-sm text-[#d5e3ea]">Flat 804 · +24 m to +27 m</div>
        </div>
      </aside>

      <main className="px-6 py-6 sm:px-10 sm:py-8 lg:px-16 flex flex-col">
        <div className="flex justify-end">
          <button type="button" onClick={() => navigate('/')} className="text-sm text-[#3d5363] hover:text-[#1e4d6b]">
            Back to home
          </button>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
          <h2 className="text-3xl text-[#16324a]">Sign in</h2>
          <p className="mt-2 text-[15px] text-[#3d5363]">
            Use a workspace account. The shared review password is {DEMO_PASSWORD}.
          </p>

          {isAuthenticated && user && (
            <div className="mt-5 px-3.5 py-3 bg-[#eef6f5] border border-[#b7cfcb] rounded-sm text-sm text-[#16324a] b3-fade">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1f7a72] mt-0.5 shrink-0" />
                <span>You are signed in as <b>{user.full_name}</b> ({ROLE_LABEL[user.role] ?? user.role}).</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
                <button type="button" onClick={() => navigate(from ? allowedPath(user.role, from) : homeFor(user.role), { replace: true })}
                  className="inline-flex items-center gap-1.5 bg-[#1f7a72] hover:bg-[#18655e] text-white font-semibold text-[13.5px] px-3.5 py-1.5 rounded-sm">
                  Continue to your workspace <ArrowRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => logout()} className="text-[13.5px] text-[#3d5363] hover:text-[#1e4d6b] underline underline-offset-2">
                  Sign out
                </button>
              </div>
              <p className="mt-2 pl-6 text-[12.5px] text-[#5c6e7c]">Or sign in below with another account.</p>
            </div>
          )}

          {!isAuthenticated && signedOutReason && (
            <div className="mt-5 px-3.5 py-2.5 bg-[#faf4ea] border border-[#e4dccf] rounded-sm text-sm text-[#5c4a26] flex gap-2 b3-fade" role="status">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#8a6b3a]" />
              <span>
                {signedOutReason === 'expired'
                  ? 'Your session has ended (sessions last 8 hours). Please sign in again.'
                  : 'You signed out in another tab. Sign in again to continue.'}
                {from ? ' You will go straight back to the page you were on.' : ''}
              </span>
            </div>
          )}
          {!isAuthenticated && !signedOutReason && from && (
            <div className="mt-5 px-3.5 py-2.5 bg-[#eef4f8] border border-[#c5d4de] rounded-sm text-sm text-[#1e4d6b] flex gap-2 b3-fade" role="status">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Sign in to open that page. You will go straight there afterwards.</span>
            </div>
          )}

          <div aria-live="assertive">
            {error && (
              <div role="alert" className="mt-5 px-3 py-2.5 bg-[#fde8e6] border border-[#e7b2ab] text-[#8a2e26] text-sm rounded-sm flex gap-2">
                {(error === OFFLINE_MESSAGE || error === OFFLINE_SIGN_IN) && <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{error}</span>
              </div>
            )}
          </div>

          <form ref={formRef} onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-[#1b3344] mb-1.5">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
                autoComplete="username"
                inputMode="email"
                className="w-full px-3 py-2.5 bg-white border border-[#d5cbbd] rounded-sm text-[15px] text-[#16324a] focus:outline-none focus:border-[#1f7a72] focus:ring-2 focus:ring-[#1f7a72]/20"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-[#1b3344] mb-1.5">Password</span>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-white border border-[#d5cbbd] rounded-sm text-[15px] text-[#16324a] focus:outline-none focus:border-[#1f7a72] focus:ring-2 focus:ring-[#1f7a72]/20"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1f7a72] hover:bg-[#18655e] active:bg-[#155a54] disabled:opacity-80 disabled:cursor-wait text-white font-semibold text-[15px] py-2.5 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a72]/40 focus-visible:ring-offset-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {buttonText}
            </button>

            {/* Server status, inline so it never covers the form: waking up, a free-plan limit, or back. */}
            <div role="status">
              {backNote && !waking && !stopped && (
                <div className="rounded-sm border border-[#b7cfcb] bg-[#eef6f5] px-3.5 py-2.5 text-[13px] text-[#18655e] flex items-center gap-2 b3-fade">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {backNote}
                </div>
              )}
              {waking && (
                <div className="rounded-sm border border-[#d6e4e2] bg-white/70 px-3.5 py-3 b3-fade" data-wake-round={clock.round}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[#16324a]">{online ? copy.title : 'Waiting for your connection'}</p>
                    {online && (
                      <span className="font-mono text-[12.5px] font-semibold text-[#16324a] shrink-0" aria-label={`about ${clock.left} seconds`}>
                        {clock.left} s
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-[#e4dccf] mt-2 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500 ease-linear bg-gradient-to-r from-[#1e4d6b] to-[#1f7a72]"
                      style={{ width: `${clock.pct}%` }} />
                  </div>
                  {online && <Thinking messages={copy.steps} every={3200} className="text-[12.5px] mt-2" />}
                  <p className="text-[12.5px] text-[#5c6e7c] mt-1.5 leading-relaxed">{note}</p>
                </div>
              )}
              {stopped && (
                <div className="rounded-sm border border-[#FDBA74] bg-[#FFF7ED] px-3.5 py-3 text-[#7C2D12] b3-fade">
                  <div className="flex gap-2.5">
                    {server.state === 'suspended' ? <CalendarClock className="w-4 h-4 mt-0.5 shrink-0 text-[#C2410C]" /> : <CloudOff className="w-4 h-4 mt-0.5 shrink-0 text-[#C2410C]" />}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{limitTitle(server.state)}</p>
                      <p className="text-[12.5px] mt-0.5">Please come back {server.retryAt ? comeBack(server.retryAt) : 'in a few minutes'}.</p>
                      <p className="text-[12px] text-[#9A3412]/85 mt-1">
                        {resumePending
                          ? 'This page keeps checking and signs you in by itself as soon as the server is ready.'
                          : 'This page keeps checking and tells you when the server is ready.'}
                      </p>
                      <button type="button" disabled={checking}
                        onClick={async () => { setChecking(true); try { await checkNow(); } finally { setChecking(false); } }}
                        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9A3412] border border-[#FDBA74] bg-white rounded-sm px-2.5 py-1 hover:bg-[#FFEDD5] disabled:opacity-60">
                        <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> {checking ? 'Checking…' : 'Check now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>

          <div className="mt-8">
            <div className="text-sm font-semibold text-[#1b3344]" id="workspace-label">Workspace</div>
            <div className="mt-3 grid gap-2" role="group" aria-labelledby="workspace-label">
              {personas.map((persona) => {
                const selected = email === persona.email;
                return (
                  <button
                    key={persona.email}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setEmail(persona.email);
                      setPassword(DEMO_PASSWORD);
                      setError('');
                    }}
                    className={`text-left px-3 py-2.5 rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a72]/40 ${
                      selected
                        ? 'border-[#1f7a72] bg-[#eef6f5]'
                        : 'border-[#e4dccf] bg-white hover:border-[#b7cfcb]'
                    }`}
                  >
                    <div className="text-[15px] font-semibold text-[#16324a]">{persona.title}</div>
                    <div className="text-sm text-[#5c6e7c]">{persona.detail}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex gap-4 text-sm text-[#5c6e7c]">
            <button type="button" onClick={() => navigate('/privacy')} className="hover:text-[#1e4d6b]">Privacy</button>
            <button type="button" onClick={() => navigate('/terms')} className="hover:text-[#1e4d6b]">Terms</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
