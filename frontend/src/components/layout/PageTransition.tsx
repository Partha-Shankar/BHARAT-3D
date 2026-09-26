import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';

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

export function WorkspacePageTransition() {
  return (
    <PageTransition>
      <Outlet />
    </PageTransition>
  );
}
