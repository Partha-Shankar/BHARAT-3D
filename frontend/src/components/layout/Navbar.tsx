import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Badge } from '../ui/Badge';
import { LogOut, User as UserIcon, Shield, Layers } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();

  const roleColors: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'accent' | 'neutral' | 'danger'> = {
    SURVEYOR: 'info',
    MUNICIPALITY: 'warning',
    UTILITY_OPERATOR: 'accent',
    CITIZEN: 'success',
    ADMIN: 'danger',
  };

  return (
    <header className="bg-navy-950 text-white border-b border-navy-800 px-6 py-3 flex items-center justify-between shadow-sm z-30 sticky top-0">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded bg-gradient-to-tr from-accent-600 to-accent-400 flex items-center justify-center font-bold text-white shadow">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-tight text-white">BHARAT 3D</h1>
            <span className="text-[10px] bg-navy-800 text-slate-300 font-mono px-1.5 py-0.5 rounded border border-navy-700">v1.0-PROD</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">2D-to-3D Spatial Property & Infrastructure Registry</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user && (
          <>
            <div className="flex items-center space-x-2 bg-navy-900 px-3 py-1.5 rounded-md border border-navy-800">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-200">{user.full_name}</span>
              <Badge variant={roleColors[user.role] || 'neutral'} size="sm">
                {user.role}
              </Badge>
            </div>
            <button
              onClick={logout}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-navy-900"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
