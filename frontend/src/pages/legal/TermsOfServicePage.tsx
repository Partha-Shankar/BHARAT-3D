import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ArrowLeft, FileText, AlertCircle, Wrench, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center space-x-1.5 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-slate-900 tracking-tight">BHARAT 3D</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/login')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg px-4 py-2"
          >
            <span>Launch App</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto w-full px-6 py-12 space-y-8 flex-1">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            <span>Demonstration Prototype Terms</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="text-xs text-slate-500">
            Last Updated: September 2026 • Version 1.0 (Proof-of-Concept)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 text-sm text-slate-600 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>1. Demonstration & Evaluation Purpose</span>
            </h2>
            <p>
              By using and accessing BHARAT 3D, you acknowledge that this platform is an <strong>educational and technological demonstration prototype</strong>.
            </p>
            <p>
              It is created to showcase 3D cadastral modeling, vertical property identification (3D ULPIN / VPRID), and subterranean utility clash detection. The outputs generated within this application are for testing and demonstration purposes only and do not constitute legally binding municipal certificates or registered revenue deeds.
            </p>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-slate-700" />
              <span>2. Backend Architecture & Mocked Functions</span>
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

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>3. User Conduct & Acceptable Use</span>
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
              <li>Users may explore all demo workspaces (Surveyor Studio, Municipality, Utility Dig-Safe, and Citizen Portal).</li>
              <li>You agree not to attempt to disrupt or stress test the demonstration web servers.</li>
              <li>You understand that demonstration data may be periodically reset to baseline demo states.</li>
            </ul>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              4. Changes to Terms & Ongoing Development
            </h2>
            <p>
              As new backend capabilities, live integrations, and cloud storage features are deployed in the coming days, these terms may be updated to reflect the expanded capabilities.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6 text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2026 BHARAT 3D Prototype. All rights reserved.</div>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/privacy')} className="hover:text-slate-900">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => navigate('/')} className="hover:text-slate-900">Home</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfServicePage;
