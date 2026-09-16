import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Layers, ArrowRight, Compass, Building2, Zap, User, ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between items-center px-4 py-8 relative font-sans">
      {/* Top Bar with Home Link */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center space-x-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">BHARAT 3D</span>
        </div>
      </div>

      {/* Main Centered OpenAI / ChatGPT Clean Light Card */}
      <div className="w-full max-w-[400px] my-auto z-10 space-y-6">
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 text-white shadow-sm mb-1">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-slate-500">
            Sign in to access your spatial cadastre workspace.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@bharat3d.demo"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-slate-900 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <span className="text-[10px] text-slate-400 font-mono">demo: demo2026</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-slate-900 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm transition-all"
              isLoading={isLoading}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Persona Quick Select */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="text-[11px] font-medium text-slate-500 text-center">
              Quick select demo workspace
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectPersona('survey@bharat3d.demo')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  email === 'survey@bharat3d.demo'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold truncate">Surveyor</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">survey@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('municipality@bharat3d.demo')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  email === 'municipality@bharat3d.demo'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-semibold truncate">Municipality</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">municipality@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('utility@bharat3d.demo')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  email === 'utility@bharat3d.demo'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span className="text-xs font-semibold truncate">Utility Dig-Safe</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">utility@bharat3d.demo</div>
              </button>

              <button
                type="button"
                onClick={() => selectPersona('citizen@bharat3d.demo')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  email === 'citizen@bharat3d.demo'
                    ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold truncate">Citizen Portal</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">citizen@bharat3d.demo</div>
              </button>
            </div>
          </div>
        </div>

        {/* Minimalist Footer Note */}
        <div className="text-center text-xs text-slate-400">
          <span>Enterprise 3D Cadastre • ISO 19152 LADM</span>
        </div>
      </div>

      {/* Bottom Minimal Footer */}
      <div className="w-full max-w-4xl flex items-center justify-between text-[11px] text-slate-400 z-10">
        <div>BHARAT 3D Geospatial Intelligence</div>
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/privacy')} className="hover:text-slate-600 transition-colors">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => navigate('/terms')} className="hover:text-slate-600 transition-colors">Terms of Service</button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
