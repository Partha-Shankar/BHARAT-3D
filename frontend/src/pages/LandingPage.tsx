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
  Eye,
  Check,
  ChevronRight,
  FileCheck2,
  MapPin
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* Clean Top Navigation Bar */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">BHARAT 3D</span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-xs font-medium text-slate-600">
            <a href="#overview" className="hover:text-slate-900 transition-colors">Overview</a>
            <a href="#portals" className="hover:text-slate-900 transition-colors">Workspaces</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Capabilities</a>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5"
            >
              Sign In
            </button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg px-4 py-2"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="overview" className="py-20 px-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
            <span>Sovereign 3D Cadastre & Digital Twin Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            2D-to-3D Spatial Property & Infrastructure Registry
          </h1>

          <p className="max-w-2xl mx-auto text-base text-slate-600 leading-relaxed font-normal">
            A unified geospatial system for mapping high-rise buildings, underground metro transit lines, utility pipes, and elevated flyovers with sovereign 3D property identifiers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2.5 text-xs rounded-lg shadow-sm"
            >
              <span>Enter Spatial Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/3d-space')}
              className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium px-6 py-2.5 text-xs rounded-lg shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
              <span>Explore 3D Digital Twin</span>
            </Button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="text-xl font-bold text-slate-900 font-mono">100%</div>
              <div className="text-xs text-slate-500 mt-0.5">2D-to-3D Cadastre</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="text-xl font-bold text-slate-900 font-mono">360°</div>
              <div className="text-xs text-slate-500 mt-0.5">Subsurface Orbit</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="text-xl font-bold text-slate-900 font-mono">ISO 19152</div>
              <div className="text-xs text-slate-500 mt-0.5">LADM Compliant</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="text-xl font-bold text-slate-900 font-mono">0 Clashes</div>
              <div className="text-xs text-slate-500 mt-0.5">Excavation Safety</div>
            </div>
          </div>
        </div>
      </section>

      {/* Four Core Workspaces Section */}
      <section id="portals" className="py-16 px-6 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-1.5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stakeholder Portals</h2>
            <h3 className="text-2xl font-bold text-slate-900">Dedicated Spatial Workspaces</h3>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Select your role to access tools for survey processing, municipal enforcement, utility safety, or property ownership.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Surveyor */}
            <div
              onClick={() => navigate('/login')}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Surveyor Studio
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ingest drone imagery and LiDAR point clouds. Delineate survey boundaries and reconstruct 3D floor slabs and vertical units.
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-blue-700 pt-1">
                <span>Open Portal</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Municipality */}
            <div
              onClick={() => navigate('/login')}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Municipal Enforcement
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Inspect building heights against sanctioned plans. Automatically flag unauthorized floors and setback violations.
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-amber-700 pt-1">
                <span>Open Portal</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Utility Dig-Safe */}
            <div
              onClick={() => navigate('/login')}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-700 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-orange-700 transition-colors">
                  Utility Dig-Safe
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Simulate proposed excavation trenches. Prevent strikes with automated 3D buffer clash detection against metro lines and pipes.
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-orange-700 pt-1">
                <span>Open Portal</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Citizen Registry */}
            <div
              onClick={() => navigate('/login')}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Citizen Property Card
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Search 3D property records by ULPIN or flat number. Inspect registered title ownership and view municipal property tax assessments.
                </p>
              </div>
              <div className="flex items-center text-xs font-semibold text-emerald-700 pt-1">
                <span>Open Portal</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="features" className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-1.5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Features</h2>
            <h3 className="text-2xl font-bold text-slate-900">Complete Spatial Cadastre Engine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-sm">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg w-fit">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Multi-Unit High-Rise Strata</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Stratifies building envelopes into discrete floor slabs and individual apartments. Each flat holds independent registered property titles.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-sm">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg w-fit">
                <Train className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Subterranean Infrastructure</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full 360-degree underground spherical orbit to inspect metro transit tunnels, multi-level basement parking, and sub-surface utility networks.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-sm">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Automated Compliance</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mathematical verification of building heights against municipal master sanctions, flagging illegal vertical floors in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8 px-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-slate-700 font-semibold">
            <div className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center text-white">
              <Layers className="w-3 h-3" />
            </div>
            <span>BHARAT 3D</span>
          </div>
          <div className="flex items-center space-x-6 text-slate-500">
            <a href="#overview" className="hover:text-slate-900">Overview</a>
            <a href="#portals" className="hover:text-slate-900">Workspaces</a>
            <a href="#features" className="hover:text-slate-900">Capabilities</a>
            <button onClick={() => navigate('/login')} className="hover:text-slate-900">Sign In</button>
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
