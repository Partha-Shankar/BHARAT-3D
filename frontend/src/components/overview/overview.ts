/**
 * The BHARAT 3D overview (YouTube). Shared by the landing-page section, the corner player and the workspace sidebar.
 *
 * The player is controlled with YouTube's postMessage protocol (the same one its iframe API uses), so no YouTube
 * script is loaded into the page, and nothing from YouTube loads until a visitor reaches the overview or asks for it.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { create } from 'zustand';
import { trackAction } from '../../lib/track';

export const OVERVIEW_ID = 'EFDw-kX0smo';
export const OVERVIEW_WATCH_URL = `https://youtu.be/${OVERVIEW_ID}`;
export const OVERVIEW_POSTER = '/media/bharat3d-overview-poster.webp';
/** 16:6 band of the poster (logo and tagline) for the workspace sidebar. */
export const OVERVIEW_SIDEBAR_THUMB = '/media/bharat3d-overview-sidebar.webp';
/** Length of the overview, shown on its thumbnails. */
export const OVERVIEW_DURATION = '1:00';
export const OVERVIEW_PLAY_EVENT = 'b3:overview-play'; // "play with sound" request from elsewhere on the landing page
const YT = 'https://www.youtube-nocookie.com';

export function overviewSrc(opts: { autoplay: boolean; muted: boolean }): string {
  const p = new URLSearchParams({
    autoplay: opts.autoplay ? '1' : '0',
    mute: opts.muted ? '1' : '0',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    color: 'white',
    enablejsapi: '1',
    origin: window.location.origin,
  });
  return `${YT}/embed/${OVERVIEW_ID}?${p.toString()}`;
}

/** Visitors who asked for less motion or less data are never auto-played; they get the poster and a play button. */
export function autoplayAllowed(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) return false;
  } catch { /* old browser: allow */ }
  return true;
}

let warmed = false;
/** Open the connections early, while the visitor is still scrolling towards the overview. */
export function warmUpOverview() {
  if (warmed) return;
  warmed = true;
  for (const href of [YT, 'https://i.ytimg.com']) {
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = href;
    l.crossOrigin = '';
    document.head.appendChild(l);
  }
}

export const YT_ENDED = 0;
export const YT_PLAYING = 1;
export const YT_PAUSED = 2;
export const YT_BUFFERING = 3;

export type OverviewInfo = { state: number | null; time: number; duration: number; muted: boolean | null };
const EMPTY: OverviewInfo = { state: null, time: 0, duration: 0, muted: null };

/**
 * Two-way link to the player in `frame`. Call `onLoad` from the iframe's load event; after that `info` follows the
 * player (state, time, duration, muted) and `send` runs player commands such as playVideo or unMute.
 */
export function useYouTubePlayer(frame: RefObject<HTMLIFrameElement>) {
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState<OverviewInfo>(EMPTY);

  useEffect(() => {
    if (!loaded) return;
    let heard = false;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== YT || e.source !== frame.current?.contentWindow) return;
      let d: { event?: string; info?: unknown } | null = null;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!d) return;
      heard = true;
      if (d.event === 'onStateChange' && typeof d.info === 'number') {
        const state = d.info;
        setInfo((s) => ({ ...s, state }));
      } else if ((d.event === 'infoDelivery' || d.event === 'initialDelivery') && d.info && typeof d.info === 'object') {
        const i = d.info as { playerState?: number; currentTime?: number; duration?: number; muted?: boolean };
        setInfo((s) => ({
          state: typeof i.playerState === 'number' ? i.playerState : s.state,
          time: typeof i.currentTime === 'number' ? i.currentTime : s.time,
          duration: i.duration || s.duration,
          muted: typeof i.muted === 'boolean' ? i.muted : s.muted,
        }));
      }
    };
    window.addEventListener('message', onMsg);
    // Ask the player to report to us, repeating until it answers (YouTube's own API does the same).
    let tries = 0;
    const t = window.setInterval(() => {
      if (heard || tries++ > 40) {
        window.clearInterval(t);
        return;
      }
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT);
    }, 250);
    return () => {
      window.removeEventListener('message', onMsg);
      window.clearInterval(t);
    };
  }, [loaded, frame]);

  const send = useCallback((func: string, args: unknown[] = []) => {
    if (!loaded) return;
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }), YT);
  }, [loaded, frame]);

  const onLoad = useCallback(() => setLoaded(true), []);
  const reset = useCallback(() => { setLoaded(false); setInfo(EMPTY); }, []);
  return { info, send, onLoad, loaded, reset };
}

/** The overview window (opened from the workspace sidebar). */
type OverviewModalState = { open: boolean; openOverview: (source: string) => void; close: () => void };
export const useOverviewModal = create<OverviewModalState>((set) => ({
  open: false,
  openOverview: (source) => {
    set({ open: true });
    trackAction('overview_open', 'Opened the BHARAT 3D overview', { source });
  },
  close: () => set({ open: false }),
}));
