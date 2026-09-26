import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Database, Lock, Clock } from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';

export const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="public-shell min-h-screen flex flex-col">
      <PublicHeader />

      <main className="max-w-3xl mx-auto w-full px-5 py-12 space-y-8 flex-1">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#eef6f5] border border-[#b7cfcb] text-[#1f7a72] text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Interactive demo & transparency notice</span>
          </div>
          <h1 className="text-3xl tracking-tight text-[#16324a]">Privacy Policy</h1>
          <p className="text-xs text-[#5c6e7c]">Last updated: September 2026 · Version 1.0 (demo prototype)</p>
        </div>

        <div className="bg-white border border-[#e4dccf] rounded-sm p-8 shadow-sm space-y-6 text-sm text-[#3d5363] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1e4d6b]" />
              <span>1. Demonstration prototype status</span>
            </h2>
            <p>
              BHARAT 3D is currently an <strong>interactive demonstration prototype</strong> designed to showcase 2D-to-3D spatial property registration, subterranean utility clash analysis, and municipal compliance.
            </p>
            <p>
              The full backend infrastructure and heavy geospatial computing microservices are <strong>not yet completely configured</strong> in production. To provide a fast, smooth, and crash-free user experience, several data ingestion, photogrammetry rendering, and calculation routines are currently <strong>mocked and simulated in the client and API layer</strong>.
            </p>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#1e4d6b]" />
              <span>2. What data we collect & store</span>
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong>Demo account credentials</strong>: Quick persona logins (Surveyor, Municipality, Utility, Citizen) use pre-seeded test accounts. No real personal passwords are saved.</li>
              <li><strong>Uploaded sample files</strong>: Files dragged into the data ingestion page (such as sample drone images or LiDAR point clouds) are processed purely within your browser memory or temporary demo sessions. We do not store or sell your files.</li>
              <li><strong>No third-party tracking</strong>: We do not use third-party tracking scripts, advertising trackers, or external profiling cookies.</li>
            </ul>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#1e4d6b]" />
              <span>3. Upcoming backend work & improvements</span>
            </h2>
            <p>
              Our engineering team is actively working in the upcoming days to connect live high-performance compute clusters, integrate real-time satellite / LiDAR ingestion pipelines, and enable full persistent spatial database storage (PostGIS & 3D CityDB).
            </p>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a]">4. Contact & inquiries</h2>
            <p>
              If you have any questions or feedback regarding this demo system, please contact the development team directly via the official project repository.
            </p>
          </section>
        </div>
      </main>

      <footer className="mt-auto bg-[#1e4d6b] text-[#d5e3ea]">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
          <div>
            <div className="text-[#f3efe6] font-semibold">BHARAT 3D</div>
            <div className="mt-1">SIH 2026 · PS 26011</div>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => navigate('/terms')} className="hover:text-white">
              Terms
            </button>
            <button type="button" onClick={() => navigate('/')} className="hover:text-white">
              Home
            </button>
            <button type="button" onClick={() => navigate('/login')} className="hover:text-white">
              Sign in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
