import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { WorkspacePageTransition } from './PageTransition';
import { BrandLogo } from './BrandLogo';

export type WorkspaceNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayRole = user?.role || defaultRoleLabel;

  return (
    <div className="workspace-shell flex h-screen overflow-hidden">
      <aside className="w-64 bg-[#1e4d6b] text-[#d5e3ea] flex flex-col justify-between border-r border-[#173e56] z-20 shrink-0">
        <div>
          <div className="p-4 flex items-center gap-3 border-b border-[#173e56]">
            <BrandLogo className="h-10 w-10" />
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[#f3efe6] tracking-tight truncate">BHARAT 3D</h1>
              <p className="text-[10px] text-[#8fb4c9] font-medium leading-snug truncate">{portalSubtitle}</p>
            </div>
          </div>

          <nav className="py-3 px-2 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8fb4c9]">
              {sectionLabel}
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#173e56] text-[#8fd0c8] font-semibold border-l-[3px] border-[#1f7a72] pl-[9px]'
                        : 'text-[#d5e3ea] hover:bg-[#173e56]/70 hover:text-white border-l-[3px] border-transparent pl-[9px]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
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

      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#f3efe6] min-w-0">
        <WorkspacePageTransition />
      </main>
    </div>
  );
}
