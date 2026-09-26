import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

type PublicHeaderProps = {
  showSectionNav?: boolean;
};

export function PublicHeader({ showSectionNav = false }: PublicHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-[#e4dccf] bg-[#f3efe6]/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
          <BrandLogo className="h-10 w-10" />
          <span className="text-[15px] font-semibold tracking-tight text-[#1e4d6b]">BHARAT 3D</span>
        </button>
        {showSectionNav ? (
          <nav className="hidden md:flex items-center gap-7 text-[15px] text-[#3d5363]">
            <a href="/#solution" className="hover:text-[#1e4d6b]">
              Solution
            </a>
            <a href="/#extension" className="hover:text-[#1e4d6b]">
              3D ULPIN
            </a>
            <a href="/#workspaces" className="hover:text-[#1e4d6b]">
              Workspaces
            </a>
          </nav>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="text-[15px] text-[#3d5363] hover:text-[#1e4d6b]"
          >
            Back to home
          </button>
        )}
        <button
          onClick={() => navigate('/login')}
          className="bg-[#1f7a72] hover:bg-[#18655e] text-white text-[15px] font-semibold px-4 py-2 rounded-sm shrink-0"
        >
          Sign in
        </button>
      </div>
    </header>
  );
}
