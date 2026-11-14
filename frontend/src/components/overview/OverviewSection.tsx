import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpLeft, ExternalLink, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { trackAction } from '../../lib/track';
import {
  OVERVIEW_PLAY_EVENT, OVERVIEW_POSTER, OVERVIEW_WATCH_URL, YT_BUFFERING, YT_ENDED, YT_PAUSED, YT_PLAYING,
  autoplayAllowed, overviewSrc, useYouTubePlayer, warmUpOverview,
} from './overview';

/** "Watch the overview | 1 min" pill shown on the poster before the overview has started. */
export const OverviewPlayPill: React.FC = () => (
  <span className="flex items-center gap-3 sm:gap-4 rounded-full bg-white/95 group-hover:bg-white pl-2 pr-5 sm:pr-6 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.04]">
    <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1f8a7d] text-white flex items-center justify-center b3-overview-ring">
      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
    </span>
    <span className="text-[15px] sm:text-[18px] font-semibold text-[#0B1A33] whitespace-nowrap">Watch the overview</span>
    <span className="hidden sm:block w-px h-6 bg-[#c8d0d8]" />
    <span className="hidden sm:block text-[14px] text-[#5a6a7a] whitespace-nowrap">1 min</span>
  </span>
);

/**
 * Landing-page overview. Starts without sound when half of it is on screen (browsers only allow silent autoplay), with a
 * "Sound on" button. If the visitor scrolls on while it plays, it continues in a small player in the corner. Nothing
 * from YouTube loads before the visitor gets close to it, so the page itself stays as fast as before.
 */
export const OverviewSection: React.FC = () => {
  const navigate = useNavigate();
  const slotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const dismissed = useRef(false); // the visitor closed the corner player
  const userPaused = useRef(false); // the visitor paused the overview themselves
  const ourPause = useRef(false); // a pause sent by this component, not by the visitor
  const reported = useRef(new Set<string>());
  const { info, send, onLoad, loaded } = useYouTubePlayer(frameRef);

  const playing = info.state === YT_PLAYING || info.state === YT_BUFFERING;
  const ended = info.state === YT_ENDED;
  const progress = info.duration ? Math.min(1, info.time / info.duration) : 0;

  const once = useCallback((action: string, text: string) => {
    if (reported.current.has(action)) return;
    reported.current.add(action);
    trackAction(action, text);
  }, []);

  // How much of the overview is on screen; open the connections early when the visitor is getting close.
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRatio(e.intersectionRatio), { threshold: [0, 0.15, 0.3, 0.5, 0.7, 1] });
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        warmUpOverview();
        near.disconnect();
      }
    }, { rootMargin: '900px 0px' });
    io.observe(el);
    near.observe(el);
    return () => {
      io.disconnect();
      near.disconnect();
    };
  }, []);

  // Half on screen: start without sound, or resume. Scrolled away while playing: continue in the corner.
  useEffect(() => {
    if (ratio >= 0.5) {
      dismissed.current = false;
      setDocked(false);
      if (!src) {
        if (autoplayAllowed()) {
          setSrc(overviewSrc({ autoplay: true, muted: true }));
          once('overview_autoplay', 'Overview started without sound when scrolled into view');
        }
      } else if (!userPaused.current && !ended && !playing) {
        send('playVideo');
      }
    } else if (ratio < 0.15 && playing && !dismissed.current) {
      setDocked(true);
      once('overview_docked', 'Overview continued in the corner player');
    }
    // Only scrolling decides this; reacting to play/pause here would fight the visitor's own pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  // It started playing after the visitor had already scrolled past (slow connection): move it to the corner.
  useEffect(() => {
    if (playing && ratio < 0.15 && !dismissed.current) setDocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Who paused it, and the milestones worth recording.
  useEffect(() => {
    if (info.state === YT_PAUSED) {
      if (ourPause.current) ourPause.current = false;
      else userPaused.current = true;
    } else if (info.state === YT_PLAYING) {
      userPaused.current = false;
      once('overview_playing', 'Overview is playing');
    } else if (info.state === YT_ENDED) {
      once('overview_completed', 'Watched the overview to the end');
      if (docked) {
        const t = window.setTimeout(() => setDocked(false), 2600);
        return () => window.clearTimeout(t);
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.state]);

  useEffect(() => {
    if (progress >= 0.5) once('overview_half', 'Watched half of the overview');
  }, [progress, once]);

  useEffect(() => {
    if (typeof info.muted === 'boolean') setIsMuted(info.muted);
  }, [info.muted]);

  const soundOn = () => {
    send('unMute');
    send('setVolume', [100]);
    setIsMuted(false);
    once('overview_sound', 'Turned the overview sound on');
  };

  const playWithSound = useCallback(() => {
    userPaused.current = false;
    dismissed.current = false;
    setIsMuted(false);
    if (!src) {
      setSrc(overviewSrc({ autoplay: true, muted: false }));
    } else {
      send('unMute');
      send('setVolume', [100]);
      if (ended) send('seekTo', [0, true]);
      send('playVideo');
    }
    once('overview_play_click', 'Pressed play on the overview');
  }, [src, ended, send, once]);

  // "Watch the overview" in the hero scrolls here and starts it with sound.
  useEffect(() => {
    const h = () => playWithSound();
    window.addEventListener(OVERVIEW_PLAY_EVENT, h);
    return () => window.removeEventListener(OVERVIEW_PLAY_EVENT, h);
  }, [playWithSound]);

  const replay = () => {
    userPaused.current = false;
    send('seekTo', [0, true]);
    send('playVideo');
  };
  const backToOverview = () => slotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const closeDock = () => {
    ourPause.current = true;
    send('pauseVideo');
    dismissed.current = true;
    setDocked(false);
  };

  return (
    <section id="overview" className="relative overflow-hidden bg-[#0A1730] text-white scroll-mt-16">
      <div aria-hidden className="absolute inset-0 b3-overview-glow pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-5 py-14 lg:py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
          <div>
            <p className="text-[12.5px] font-semibold tracking-[0.2em] uppercase text-[#5fc4b6]">Overview · 1 minute</p>
            <h2 className="mt-2.5 text-3xl sm:text-[2.6rem] leading-tight font-serif text-white">Every space, on record.</h2>
            <p className="mt-3 max-w-2xl text-[16.5px] leading-7 text-[#c3d2df]">
              BHARAT 3D in one minute: how a flat, a basement, an air-rights band or a metro tunnel gets its own
              identity, on top of the ULPIN India already uses.
            </p>
          </div>
          <a
            href={OVERVIEW_WATCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAction('overview_youtube', 'Opened the overview on YouTube')}
            className="inline-flex items-center gap-1.5 text-[13.5px] text-[#8fb4c9] hover:text-white shrink-0"
          >
            Watch on YouTube <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div ref={slotRef} className="relative aspect-video w-full">
          {docked && (
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-3 text-[#8fb4c9] text-sm">
              <span>The overview is playing in the corner.</span>
              <button onClick={backToOverview} className="inline-flex items-center gap-2 rounded-full border border-white/20 hover:border-white/50 text-white px-4 py-1.5">
                <ArrowUpLeft className="w-4 h-4" /> Bring it back here
              </button>
            </div>
          )}

          <div className={docked ? 'fixed z-[900] right-3 bottom-3 sm:right-5 sm:bottom-5 w-[min(380px,62vw)] aspect-video b3-overview-dock' : 'absolute inset-0'}>
            <div className={`relative w-full h-full overflow-hidden bg-[#050c18] ${docked
              ? 'rounded-xl ring-1 ring-white/20 shadow-[0_18px_50px_rgba(0,0,0,0.5)]'
              : 'rounded-2xl ring-1 ring-white/10 shadow-[0_30px_80px_rgba(4,12,28,0.6)]'}`}
            >
              <img src={OVERVIEW_POSTER} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
              {src ? (
                <iframe
                  ref={frameRef}
                  src={src}
                  onLoad={onLoad}
                  title="BHARAT 3D overview"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : (
                <button onClick={playWithSound} aria-label="Play the BHARAT 3D overview" className="group absolute inset-0 w-full h-full">
                  <span className="absolute left-1/2 top-[83%] -translate-x-1/2 -translate-y-1/2">
                    <OverviewPlayPill />
                  </span>
                </button>
              )}

              {src && isMuted && !ended && (
                // Top centre: the one place YouTube's own title, buttons and time display never use.
                // (Positioned by the wrapper; the pop-in animation on the button would cancel a translate.)
                // On phones the player is too small for it: a full-width button under the player is used instead.
                <div className={`absolute z-10 pointer-events-none ${docked ? 'flex left-2 top-2' : 'hidden sm:flex inset-x-0 top-4 justify-center'}`}>
                  <button
                    onClick={soundOn}
                    className={`pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 hover:bg-white text-[#0B1A33] font-semibold shadow-lg b3-pop ${docked
                      ? 'px-2.5 py-1 text-[11px]'
                      : 'px-4 py-2 text-[13.5px]'}`}
                  >
                    <VolumeX className={docked ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> Sound on
                  </button>
                </div>
              )}

              {docked && (
                <>
                  <div className="absolute right-2 top-2 z-10 flex gap-1.5">
                    <button onClick={backToOverview} aria-label="Back to the overview section" title="Back to the overview"
                      className="w-7 h-7 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center">
                      <ArrowUpLeft className="w-4 h-4" />
                    </button>
                    <button onClick={closeDock} aria-label="Close the corner player" title="Close"
                      className="w-7 h-7 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/15 pointer-events-none">
                    <div className="h-full bg-[#5fc4b6] transition-[width] duration-500 ease-linear" style={{ width: `${progress * 100}%` }} />
                  </div>
                </>
              )}

              {ended && !docked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-[#0A1730]/[0.93] backdrop-blur-sm b3-fade">
                  <p className="font-serif text-2xl sm:text-4xl text-white">Every space, on record.</p>
                  <p className="mt-2 text-[#c3d2df] text-sm sm:text-base">See it on a real ward: open any workspace with the demo account.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button onClick={() => navigate('/login')} className="bg-[#1f8a7d] hover:bg-[#1a776c] text-white font-semibold text-[14.5px] px-5 py-2.5 rounded-sm">
                      Open a workspace
                    </button>
                    <button onClick={replay} className="inline-flex items-center gap-2 border border-white/25 hover:border-white/60 text-white text-[14.5px] px-5 py-2.5 rounded-sm">
                      <RotateCcw className="w-4 h-4" /> Watch again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {src && isMuted && !ended && !docked && (
          <button onClick={soundOn} className="sm:hidden mt-3 w-full flex items-center justify-center gap-2 rounded-full bg-white text-[#0B1A33] font-semibold text-[14px] py-2.5 b3-pop">
            <VolumeX className="w-4 h-4" /> Sound on
          </button>
        )}
        <p className="mt-4 flex items-start gap-2 text-[13px] leading-5 text-[#8fb4c9]">
          <Volume2 className="w-4 h-4 shrink-0 mt-0.5" />
          It plays without sound when you scroll here — press “Sound on” to listen. Keep scrolling and it continues in the corner.
        </p>
      </div>
    </section>
  );
};

export default OverviewSection;
