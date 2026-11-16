import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, User, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_LABEL } from '../../lib/roles';
import { WorkspacePageTransition } from './PageTransition';
import { BrandLogo } from './BrandLogo';
import { SidebarOverviewCard } from '../overview/SidebarOverviewCard';

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

/**
 * The signed-in workspace: sidebar navigation (groups, a gliding active indicator, the overview video, the user and
 * Sign out) beside the page. On screens narrower than 768 px the sidebar becomes a menu that slides in from the left,
 * opened from a slim top bar, so the page keeps the full width of the phone.
 */
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [barKey, setBarKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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

  // the phone menu closes when a page is chosen, and on Escape; focus moves into it and back out again
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    const menuButton = menuButtonRef.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      menuButton?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  const displayRole = ROLE_LABEL[String(user?.role)] ?? (user?.role || defaultRoleLabel);
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

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-[#06101F]/55 md:hidden b3-fade" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      <aside
        id="workspace-menu"
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] md:static md:z-20 md:w-64 md:max-w-none md:translate-x-0 bg-[#1e4d6b] text-[#d5e3ea] flex flex-col justify-between border-r border-[#173e56] shrink-0 motion-safe:transition-transform motion-safe:duration-300 ${
          menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label={`${sectionLabel} navigation`}
      >
        <div className="min-h-0 overflow-y-auto b3-scroll">
          <div className="p-4 flex items-center gap-3 border-b border-[#173e56]">
            <BrandLogo className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-[#f3efe6] tracking-tight truncate">BHARAT 3D</div>
              <p className="text-[10px] text-[#8fb4c9] font-medium leading-snug truncate">{portalSubtitle}</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMenuOpen(false)}
              className="md:hidden p-1.5 rounded-sm text-[#8fb4c9] hover:text-white hover:bg-[#173e56]"
              aria-label="Close the menu"
            >
              <X className="w-5 h-5" />
            </button>
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
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium transition-colors duration-300 border-l-[3px] border-transparent pl-[9px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8fd0c8]/70 ${
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
          <div className="mb-2.5 pb-2.5 border-b border-[#2d6484]">
            <SidebarOverviewCard />
          </div>
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
              className="p-1.5 rounded-sm text-[#8fb4c9] hover:text-[#fde8e6] hover:bg-[#1e4d6b] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8fd0c8]/70"
              title="Sign out"
              aria-label="Sign out"
              type="button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* phones and small tablets: a slim bar with the menu button instead of the sidebar */}
        <header className="md:hidden h-14 shrink-0 bg-[#1e4d6b] text-[#f3efe6] flex items-center gap-3 px-3 border-b border-[#173e56]">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-1 rounded-sm text-[#d5e3ea] hover:text-white hover:bg-[#173e56]"
            aria-label="Open the menu"
            aria-expanded={menuOpen}
            aria-controls="workspace-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo className="h-8 w-8" />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">BHARAT 3D</div>
            <div className="text-[10px] text-[#8fb4c9] leading-tight truncate">{portalSubtitle}</div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden bg-[#f3efe6] min-w-0 b3-scroll">
          <WorkspacePageTransition />
        </main>
      </div>
    </div>
  );
}
