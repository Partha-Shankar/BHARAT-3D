import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useOutlet, Outlet } from 'react-router-dom';

/** Fades/slides route content; remounts on pathname change. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter flex flex-col flex-1 min-h-0">
      {children}
    </div>
  );
}

export function PublicPageShell() {
  return (
    <PageTransition>
      <Outlet />
    </PageTransition>
  );
}

const EXIT_MS = 160;

/**
 * Workspace route transition: the outgoing page fades up and out, then the incoming page rises in. The outgoing
 * element is the last committed outlet (kept in a ref after commit, so StrictMode double renders cannot swap it).
 */
export function WorkspacePageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const committed = useRef<{ key: string; el: React.ReactNode }>({ key: location.pathname, el: outlet });
  const [leaving, setLeaving] = useState<{ key: string; el: React.ReactNode } | null>(null);
  const [shownKey, setShownKey] = useState(location.pathname);

  if (shownKey !== location.pathname && (!leaving || leaving.key !== shownKey)) {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) setShownKey(location.pathname);
    else setLeaving({ key: shownKey, el: committed.current.el });
  }

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setShownKey(location.pathname);
      setLeaving(null);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [leaving, location.pathname]);

  useLayoutEffect(() => {
    if (!leaving && shownKey === location.pathname) committed.current = { key: location.pathname, el: outlet };
  });

  if (leaving) {
    return (
      <div key={leaving.key} className="b3-page-out flex flex-col flex-1 min-h-0">
        {leaving.el}
      </div>
    );
  }
  return (
    <div key={shownKey} className="b3-page flex flex-col flex-1 min-h-0">
      {outlet}
    </div>
  );
}
