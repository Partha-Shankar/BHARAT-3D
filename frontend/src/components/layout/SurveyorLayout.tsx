import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutDashboard,
  FolderKanban,
  Map as MapIcon,
  UploadCloud,
  Box,
  FileCheck2,
  AlertTriangle,
  History,
  LogOut,
  Layers,
  Activity,
  User,
} from 'lucide-react';

export default function SurveyorLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/surveyor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/surveyor/projects', icon: FolderKanban, label: 'Projects & Survey' },
    { to: '/surveyor/map', icon: MapIcon, label: '2D/3D Cadastre Map' },
    { to: '/surveyor/upload', icon: UploadCloud, label: 'Data Ingestion' },
    { to: '/surveyor/editor', icon: Box, label: '3D Cadastre Editor' },
    { to: '/surveyor/registry', icon: FileCheck2, label: '3D Property Registry' },
    { to: '/surveyor/violations', icon: AlertTriangle, label: 'Bylaw Violations' },
    { to: '/surveyor/audit', icon: History, label: 'Audit Trail' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 z-20">
        <div>
          {/* Logo Header */}
          <div className="p-4 flex items-center space-x-3 border-b border-slate-800 bg-slate-950">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center font-bold text-white shadow">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">BHARAT 3D</h1>
              <p className="text-[10px] text-slate-400 font-medium leading-none">2D-to-3D Spatial Cadastre</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="py-3 px-2 space-y-0.5">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Surveyor Studio
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

        {/* Footer & Persona Info */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate max-w-[120px]">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Demo Surveyor'}</p>
                <p className="text-[10px] text-amber-400 uppercase font-mono font-medium">{user?.role || 'SURVEYOR'}</p>
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
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
