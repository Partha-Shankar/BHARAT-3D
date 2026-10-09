import React, { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { WorkspacePageTransition } from './PageTransition';
import { BrandLogo } from './BrandLogo';

export type WorkspaceNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  group?: string;
  badge?: React.ReactNode;
  /** other paths that should light this item up */
  also?: string[];
};

type WorkspaceShellProps = {
  portalSubtitle: string;
  sectionLabel: string;
  navItems: WorkspaceNavItem[];
  defaultUserName: string;
  defaultRoleLabel: string;
};

export function WorkspaceShell({
  portalSubtitle,
  sectionLabel,
  navItems,
  defaultUserName,
  defaultRoleLabel,
}: WorkspaceShellProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [barKey, setBarKey] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (item: WorkspaceNavItem) =>
    location.pathname === item.to || (item.also ?? []).some((p) => location.pathname.startsWith(p));

  // glide the active indicator to the current item; run the route bar; scroll the new page to the top
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLAnchorElement>('a[data-active="true"]');
    setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
    setBarKey((k) => k + 1);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const displayRole = user?.role || defaultRoleLabel;
  const groups: { name: string; items: WorkspaceNavItem[] }[] = [];
  navItems.forEach((it) => {
    const g = it.group ?? sectionLabel;
    const found = groups.find((x) => x.name === g);
    if (found) found.items.push(it);
    else groups.push({ name: g, items: [it] });
  });

  return (
    <div className="workspace-shell flex h-screen overflow-hidden">
      <span key={barKey} className="b3-route-bar is-run w-full" />
      <aside className="w-64 bg-[#1e4d6b] text-[#d5e3ea] flex flex-col justify-between border-r border-[#173e56] z-20 shrink-0">
        <div className="min-h-0 overflow-y-auto">
          <div className="p-4 flex items-center gap-3 border-b border-[#173e56]">
            <BrandLogo className="h-10 w-10" />
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[#f3efe6] tracking-tight truncate">BHARAT 3D</h1>
              <p className="text-[10px] text-[#8fb4c9] font-medium leading-snug truncate">{portalSubtitle}</p>
            </div>
          </div>

          <nav ref={navRef} className="b3-nav py-3 px-2">
            {pill && <span className="b3-nav-pill" style={{ top: pill.top, height: pill.height }} />}
            {groups.map((g, gi) => (
              <div key={g.name} className={gi ? 'mt-3' : ''}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8fb4c9]">{g.name}</div>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        data-active={active}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium transition-colors duration-300 border-l-[3px] border-transparent pl-[9px] ${
                          active ? 'text-[#8fd0c8] font-semibold' : 'text-[#d5e3ea] hover:text-white hover:bg-[#173e56]/50'
                        }`}
                      >
                        <Icon className="b3-nav-icon w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                          <span className="b3-nav-badge b3-pop">{item.badge}</span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-3 bg-[#173e56] border-t border-[#2d6484]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-sm bg-[#1e4d6b] flex items-center justify-center text-[#d5e3ea] shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-[#f3efe6] truncate">{user?.full_name || defaultUserName}</p>
                <p className="text-[10px] text-[#8fd0c8] uppercase font-mono font-medium truncate">{displayRole}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-sm text-[#8fb4c9] hover:text-[#fde8e6] hover:bg-[#1e4d6b] transition-colors shrink-0"
              title="Logout"
              type="button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main ref={mainRef} className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[#f3efe6] min-w-0 b3-scroll">
        <WorkspacePageTransition />
      </main>
    </div>
  );
}
