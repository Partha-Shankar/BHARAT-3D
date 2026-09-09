import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layers, ArrowRight, Check, Compass, Building2, Zap, User, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('survey@bharat3d.demo');
  const [password, setPassword] = useState('demo2026');
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
      setError(err.response?.data?.detail || 'Invalid credentials. Select a quick persona below.');
    }
  };

  const selectPersona = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('demo2026');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center px-4 py-8 relative font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Bar with Home Link */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">BHARAT 3D</span>
        </div>
      </div>

      {/* Main Centered OpenAI / ChatGPT Style Login Card */}
      <div className="w-full max-w-[420px] my-auto z-10 space-y-6">
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-600/20 mb-1">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome to BHARAT 3D
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your sovereign spatial cadastre workspace.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 text-red-300 text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@bharat3d.demo"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <span className="text-[10px] text-slate-500 font-mono">demo: demo2026</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
              isLoading={isLoading}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Persona Quick Select */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 text-center">
              Quick select demonstration workspace
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectPersona('survey@bharat3d.demo')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email === 'survey@bharat3d.demo'
                    ? 'border-blue-500 bg-blue-600/15 text-white ring-1 ring-blue-500/50'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold truncate">Surveyor</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">survey@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('municipality@bharat3d.demo')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email === 'municipality@bharat3d.demo'
                    ? 'border-amber-500 bg-amber-600/15 text-white ring-1 ring-amber-500/50'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold truncate">Municipality</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">municipality@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('utility@bharat3d.demo')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email === 'utility@bharat3d.demo'
                    ? 'border-orange-500 bg-orange-600/15 text-white ring-1 ring-orange-500/50'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="text-xs font-bold truncate">Utility Dig-Safe</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">utility@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('citizen@bharat3d.demo')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  email === 'citizen@bharat3d.demo'
                    ? 'border-emerald-500 bg-emerald-600/15 text-white ring-1 ring-emerald-500/50'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold truncate">Citizen Portal</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">citizen@bharat3d.demo</div>
              </button>
            </div>
          </div>
        </div>

        {/* Minimalist Footer Note */}
        <div className="text-center text-xs text-slate-500">
          <span>Enterprise 3D Cadastre • ISO 19152 LADM Compliant</span>
        </div>
      </div>

      {/* Bottom Minimal Footer */}
      <div className="w-full max-w-5xl flex items-center justify-between text-[11px] text-slate-600 z-10">
        <div>BHARAT 3D Geospatial Intelligence</div>
        <div className="flex items-center space-x-4">
          <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
          <span>•</span>
          <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
