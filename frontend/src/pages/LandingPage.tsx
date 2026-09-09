import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  Train,
  Zap,
  User,
  Compass,
  Box,
  Eye,
  CheckCircle2,
  Sparkles,
  MapPin,
  FileText,
  Lock,
  ChevronRight
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePersonaSelect = (rolePath: string) => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-wider text-white">BHARAT 3D</span>
              <span className="text-[10px] text-blue-400 font-mono ml-2 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60">
                Spatial Cadastre
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#personas" className="hover:text-white transition-colors">Portals</a>
            <a href="#twin" className="hover:text-white transition-colors">3D Digital Twin</a>
            <a href="#standards" className="hover:text-white transition-colors">Standards</a>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/login')}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-bold"
            >
              Sign In
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        {/* Background glow gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Next-Generation 3D Spatial Cadastre & Digital Twin Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Transforming Flat 2D Maps into{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              High-Precision 3D Digital Twins
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
            BHARAT 3D unites multi-storey apartments, elevated flyovers, underground metro transit lines, and subterranean utility networks into a unified, queryable 3D cadastral registry.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              variant="accent"
              size="lg"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 text-sm shadow-xl shadow-blue-600/30 rounded-xl"
            >
              <span>Enter Spatial Workspace</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/3d-space')}
              className="w-full sm:w-auto border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold px-7 py-3.5 text-sm rounded-xl"
            >
              <Eye className="w-4 h-4 mr-2 text-cyan-400" />
              <span>Explore 3D Digital Twin</span>
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-blue-400 font-mono">100%</div>
              <div className="text-xs text-slate-400 mt-0.5">2D-to-3D Alignment</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-cyan-400 font-mono">360°</div>
              <div className="text-xs text-slate-400 mt-0.5">Underground Orbit</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-emerald-400 font-mono">ISO 19152</div>
              <div className="text-xs text-slate-400 mt-0.5">LADM Compliant</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl font-black text-amber-400 font-mono">0 Clashes</div>
              <div className="text-xs text-slate-400 mt-0.5">Subsurface Dig-Safe</div>
            </div>
          </div>
        </div>
      </section>

      {/* Four Stakeholder Portals Section */}
      <section id="personas" className="py-20 px-6 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-blue-400 tracking-widest uppercase">Four Core Workspaces</h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Built for Governments, Utilities & Citizens</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
              Choose your role to enter dedicated tools for survey processing, municipal enforcement, utility safety, or property ownership.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Surveyor */}
            <div
              onClick={() => handlePersonaSelect('/surveyor/dashboard')}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-850 transition-all cursor-pointer group flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Compass className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  Surveyor Studio
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ingest drone photogrammetry and LiDAR point clouds. Delineate survey boundaries and reconstruct 3D floor slabs and vertical property units.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-blue-400 pt-2">
                <span>Open Surveyor Portal</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Municipality */}
            <div
              onClick={() => handlePersonaSelect('/municipality/dashboard')}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-850 transition-all cursor-pointer group flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                  Municipal Enforcement
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inspect building heights against municipal master plans. Automatically detect unauthorized vertical floors, setback breaches, and airspace encroachments.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-amber-400 pt-2">
                <span>Open Municipal Portal</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Utility Dig-Safe */}
            <div
              onClick={() => handlePersonaSelect('/utility/dashboard')}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-orange-500/60 hover:bg-slate-850 transition-all cursor-pointer group flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                  Utility Dig-Safe
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Simulate proposed excavation trenches in 3D. Prevent costly utility strikes with automated buffer clash detection against metro tunnels and water mains.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-orange-400 pt-2">
                <span>Open Utility Portal</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Citizen Registry */}
            <div
              onClick={() => handlePersonaSelect('/citizen/dashboard')}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-850 transition-all cursor-pointer group flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Citizen Property Card
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Search 3D volumetric property records by ULPIN or flat number. View exact volume, registered title ownership, and pay municipal property taxes online.
                </p>
              </div>
              <div className="flex items-center text-xs font-bold text-emerald-400 pt-2">
                <span>Open Citizen Portal</span>
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features & Highlights */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase">System Capabilities</h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Full-Stack 3D Geospatial Engine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl w-fit">
                <Building2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Multi-Unit High-Rise Mapping</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stratifies building envelopes into discrete floor slabs and individual apartments. Each flat holds independent registered property titles and tax identifiers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="p-3 bg-cyan-600/20 text-cyan-400 rounded-xl w-fit">
                <Train className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Subterranean Infrastructure</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full 360-degree underground spherical orbit to inspect metro transit tunnels, multi-level basement parking, and sub-surface utility trunk pipelines.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Automated Compliance Engine</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mathematical verification of building heights against municipal master sanctions. Flags illegal vertical floors with instant demolition/sealing notices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-slate-400 font-semibold">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>BHARAT 3D Spatial Cadastre</span>
          </div>
          <div className="flex items-center space-x-6 text-slate-400">
            <a href="#personas" className="hover:text-white">Portals</a>
            <a href="#features" className="hover:text-white">Features</a>
            <button onClick={() => navigate('/login')} className="hover:text-white">Sign In</button>
          </div>
          <div>
            © 2026 BHARAT 3D. National Spatial Property & Infrastructure Registry.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
