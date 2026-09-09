import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layers, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'SURVEYOR' || currentUser?.role === 'ADMIN') {
        navigate('/surveyor/dashboard');
      } else if (currentUser?.role === 'MUNICIPALITY') {
        navigate('/municipality/dashboard');
      } else if (currentUser?.role === 'UTILITY_OPERATOR') {
        navigate('/utility/dashboard');
      } else if (currentUser?.role === 'CITIZEN') {
        navigate('/citizen/dashboard');
      } else {
        navigate('/surveyor/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please select a demo persona below.');
    }
  };

  const setDemoCredentials = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('demo2026');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg mb-3">
            <Layers className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">BHARAT 3D</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            2D-to-3D Spatial Property & Infrastructure Registry Platform
          </p>
          <div className="mt-2 inline-flex items-center space-x-1.5 bg-slate-800 border border-slate-700 text-amber-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Smart India Hackathon • Problem #26011</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-7">
          <h2 className="text-base font-bold text-slate-900 mb-1">Government Spatial Sign In</h2>
          <p className="text-xs text-slate-500 mb-5">
            Enter credentials or select a demonstration persona below.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="survey@bharat3d.demo"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-700"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full py-2.5" isLoading={isLoading}>
              <span>Authenticate & Enter Workspace</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Quick Demo Personas</span>
              <span className="text-[10px] text-amber-600 font-normal">Password: demo2026</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('survey@bharat3d.demo')}
                className="text-left p-2 rounded-md border border-slate-200 hover:border-slate-600 hover:bg-slate-50 transition-all text-xs"
              >
                <div className="font-semibold text-slate-900">👷 Surveyor</div>
                <div className="text-[10px] text-slate-400">survey@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('municipality@bharat3d.demo')}
                className="text-left p-2 rounded-md border border-slate-200 hover:border-slate-600 hover:bg-slate-50 transition-all text-xs"
              >
                <div className="font-semibold text-amber-900">🏛️ Municipality</div>
                <div className="text-[10px] text-slate-400">municipality@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('utility@bharat3d.demo')}
                className="text-left p-2 rounded-md border border-slate-200 hover:border-slate-600 hover:bg-slate-50 transition-all text-xs"
              >
                <div className="font-semibold text-orange-900">⚡ Utility Dig-Safe</div>
                <div className="text-[10px] text-slate-400">utility@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('citizen@bharat3d.demo')}
                className="text-left p-2 rounded-md border border-slate-200 hover:border-slate-600 hover:bg-slate-50 transition-all text-xs"
              >
                <div className="font-semibold text-green-900">👤 Citizen Portal</div>
                <div className="text-[10px] text-slate-400">citizen@bharat3d.demo</div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 text-center text-[11px] text-slate-400">
          Digital India Land Records Modernization Programme (DILRMP) • 3D Spatial Cadastre
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
