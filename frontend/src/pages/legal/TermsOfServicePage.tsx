import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle, Wrench, CheckCircle2 } from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';

export const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="public-shell min-h-screen flex flex-col">
      <PublicHeader />

      <main className="max-w-3xl mx-auto w-full px-5 py-12 space-y-8 flex-1">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#faf4ea] border border-[#e4dccf] text-[#8a6b3a] text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            <span>Demonstration prototype terms</span>
          </div>
          <h1 className="text-3xl tracking-tight text-[#16324a]">Terms of Service</h1>
          <p className="text-xs text-[#5c6e7c]">Last updated: September 2026 · Version 1.0 (proof-of-concept)</p>
        </div>

        <div className="bg-white border border-[#e4dccf] rounded-sm p-8 shadow-sm space-y-6 text-sm text-[#3d5363] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#1f7a72]" />
              <span>1. Demonstration & evaluation purpose</span>
            </h2>
            <p>
              By using and accessing BHARAT 3D, you acknowledge that this platform is an <strong>educational and technological demonstration prototype</strong>.
            </p>
            <p>
              It is created to showcase 3D cadastral modeling, vertical property identification (3D ULPIN / VPRID), and subterranean utility clash detection. The outputs generated within this application are for testing and demonstration purposes only and do not constitute legally binding municipal certificates or registered revenue deeds.
            </p>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#1e4d6b]" />
              <span>2. Backend architecture & mocked functions</span>
            </h2>
            <p>
              Please note that the backend services are <strong>not yet completely configured</strong> for production-scale distributed compute workloads.
            </p>
            <p>
              Several computational steps—such as long-running raw LiDAR point cloud densification ($10^7$ points), automated photogrammetry meshing, and simulated excavation clash checks—are currently <strong>mocked or precomputed</strong> to ensure an instant, responsive interface for evaluation.
            </p>
            <p>
              We are actively developing and hardening these backend modules in the upcoming days to support full end-to-end processing pipelines.
            </p>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1f7a72]" />
              <span>3. User conduct & acceptable use</span>
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Users may explore all demo workspaces (Surveyor Studio, Municipality, Utility Dig-Safe, and Citizen Portal).</li>
              <li>You agree not to attempt to disrupt or stress test the demonstration web servers.</li>
              <li>You understand that demonstration data may be periodically reset to baseline demo states.</li>
            </ul>
          </section>

          <hr className="border-[#e4dccf]" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-[#16324a]">4. Changes to terms & ongoing development</h2>
            <p>
              As new backend capabilities, live integrations, and cloud storage features are deployed in the coming days, these terms may be updated to reflect the expanded capabilities.
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
            <button type="button" onClick={() => navigate('/privacy')} className="hover:text-white">
              Privacy
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

export default TermsOfServicePage;
