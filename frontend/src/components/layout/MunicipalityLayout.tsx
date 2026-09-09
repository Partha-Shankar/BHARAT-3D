import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutDashboard,
  Map as MapIcon,
  Building2,
  AlertOctagon,
  Receipt,
  Network,
  History,
  LogOut,
  Layers,
  User,
} from 'lucide-react';

export default function MunicipalityLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/municipality/dashboard', icon: LayoutDashboard, label: 'Compliance Overview' },
    { to: '/municipality/map', icon: MapIcon, label: 'Municipal GIS Map' },
    { to: '/municipality/properties', icon: Building2, label: '3D Property Registry' },
    { to: '/municipality/violations', icon: AlertOctagon, label: 'Bylaw Violations (G+N)' },
    { to: '/municipality/tax', icon: Receipt, label: 'Property Tax Roll' },
    { to: '/municipality/audit', icon: History, label: 'Governance Audit' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 z-20">
        <div>
          <div className="p-4 flex items-center space-x-3 border-b border-slate-800 bg-slate-950">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center font-bold text-white shadow">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">BHARAT 3D</h1>
              <p className="text-[10px] text-slate-400 font-medium leading-none">Municipal Corporation</p>
            </div>
          </div>

          <nav className="py-3 px-2 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Urban Local Body
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-amber-400 font-semibold border-l-4 border-amber-500 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
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

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="truncate max-w-[120px]">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Municipal Officer'}</p>
              <p className="text-[10px] text-amber-400 uppercase font-mono font-medium">{user?.role || 'MUNICIPALITY'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
