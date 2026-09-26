import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { BrandLogo } from '../components/layout/BrandLogo';

const personas = [
  { email: 'survey@bharat3d.demo', title: 'Surveyor', detail: 'Confirm volumes and save identities' },
  { email: 'municipality@bharat3d.demo', title: 'Municipality', detail: 'Height, setback, and encroachment' },
  { email: 'utility@bharat3d.demo', title: 'Utility operator', detail: 'Excavation against subsurface assets' },
  { email: 'citizen@bharat3d.demo', title: 'Citizen', detail: 'Your unit and its parent parcel' },
];

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
      setError(err.response?.data?.detail || 'Those credentials were not accepted. Choose a workspace below and try again.');
    }
  };

  return (
    <div className="public-shell min-h-screen lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="bg-[#1e4d6b] text-[#e7eef2] px-6 py-8 sm:px-10 lg:px-12 lg:py-12 flex flex-col">
        <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
          <BrandLogo className="h-10 w-10" />
          <span className="text-sm font-semibold tracking-wide text-[#f3efe6]">BHARAT 3D</span>
        </button>
        <div className="mt-10 lg:mt-16 max-w-md">
          <p className="text-[#8fd0c8] text-sm font-semibold">BHARAT 3D</p>
          <h1 className="mt-3 text-3xl sm:text-4xl leading-tight text-white font-serif">
            A 3D land registry for Indian cities
          </h1>
          <p className="mt-3 text-lg text-[#d5e3ea] font-serif font-semibold">
            One ground number is not enough
          </p>
          <p className="mt-4 text-[16px] leading-7 text-[#d5e3ea]">
            The 14-digit ULPIN stays the parent parcel. Child identities cover flats, basements, air-rights, and metro segments—with height in metres—after a surveyor confirms each volume.
          </p>
        </div>
        <div className="mt-8 lg:mt-auto bg-[#173e56] border border-[#2d6484] rounded-sm p-4 max-w-md">
          <div className="text-xs uppercase tracking-wide text-[#8fd0c8]">Example</div>
          <div className="mt-2 text-[15px] text-white font-medium">48291503726481-F08-U804</div>
          <div className="mt-1 text-sm text-[#d5e3ea]">Flat 804 · +24 m to +27 m</div>
        </div>
      </aside>

      <main className="px-6 py-8 sm:px-10 lg:px-16 flex flex-col">
        <div className="flex justify-end">
          <button onClick={() => navigate('/')} className="text-sm text-[#3d5363] hover:text-[#1e4d6b]">
            Back to home
          </button>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-8">
          <h2 className="text-3xl text-[#16324a]">Sign in</h2>
          <p className="mt-2 text-[15px] text-[#3d5363]">
            Use a workspace account. The shared review password is demo2026.
          </p>

          {error && (
            <div className="mt-5 px-3 py-2.5 bg-[#fde8e6] border border-[#e7b2ab] text-[#8a2e26] text-sm rounded-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-[#1b3344] mb-1.5">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2.5 bg-white border border-[#d5cbbd] rounded-sm text-[15px] text-[#16324a] focus:outline-none focus:border-[#1f7a72] focus:ring-2 focus:ring-[#1f7a72]/20"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-[#1b3344] mb-1.5">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-white border border-[#d5cbbd] rounded-sm text-[15px] text-[#16324a] focus:outline-none focus:border-[#1f7a72] focus:ring-2 focus:ring-[#1f7a72]/20"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1f7a72] hover:bg-[#18655e] disabled:opacity-60 text-white font-semibold text-[15px] py-2.5 rounded-sm"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-sm font-semibold text-[#1b3344]">Workspace</div>
            <div className="mt-3 grid gap-2">
              {personas.map((persona) => {
                const selected = email === persona.email;
                return (
                  <button
                    key={persona.email}
                    type="button"
                    onClick={() => {
                      setEmail(persona.email);
                      setPassword('demo2026');
                    }}
                    className={`text-left px-3 py-2.5 rounded-sm border ${
                      selected
                        ? 'border-[#1f7a72] bg-[#eef6f5]'
                        : 'border-[#e4dccf] bg-white hover:border-[#b7cfcb]'
                    }`}
                  >
                    <div className="text-[15px] font-semibold text-[#16324a]">{persona.title}</div>
                    <div className="text-sm text-[#5c6e7c]">{persona.detail}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex gap-4 text-sm text-[#5c6e7c]">
            <button onClick={() => navigate('/privacy')} className="hover:text-[#1e4d6b]">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-[#1e4d6b]">Terms</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
