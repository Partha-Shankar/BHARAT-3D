import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ArrowLeft, ShieldCheck, Database, Lock, Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const PrivacyPolicyPage: React.FC = () => {
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
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Interactive Demo & Transparency Notice</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500">
            Last Updated: September 2026 • Version 1.0 (Demo Prototype)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 text-sm text-slate-600 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <span>1. Demonstration Prototype Status</span>
            </h2>
            <p>
              BHARAT 3D is currently an <strong>interactive demonstration prototype</strong> designed to showcase 2D-to-3D spatial property registration, subterranean utility clash analysis, and municipal compliance.
            </p>
            <p>
              The full backend infrastructure and heavy geospatial computing microservices are <strong>not yet completely configured</strong> in production. To provide a fast, smooth, and crash-free user experience, several data ingestion, photogrammetry rendering, and calculation routines are currently <strong>mocked and simulated in the client and API layer</strong>.
            </p>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Database className="w-4 h-4 text-slate-700" />
              <span>2. What Data We Collect & Store</span>
            </h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
              <li><strong>Demo Account Credentials</strong>: Quick persona logins (Surveyor, Municipality, Utility, Citizen) use pre-seeded test accounts. No real personal passwords are saved.</li>
              <li><strong>Uploaded Sample Files</strong>: Files dragged into the data ingestion page (such as sample drone images or LiDAR point clouds) are processed purely within your browser memory or temporary demo sessions. We do not store or sell your files.</li>
              <li><strong>No Third-Party Tracking</strong>: We do not use third-party tracking scripts, advertising trackers, or external profiling cookies.</li>
            </ul>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-slate-700" />
              <span>3. Upcoming Backend Work & Improvements</span>
            </h2>
            <p>
              Our engineering team is actively working in the upcoming days to connect live high-performance compute clusters, integrate real-time satellite / LiDAR ingestion pipelines, and enable full persistent spatial database storage (PostGIS & 3D CityDB).
            </p>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              4. Contact & Inquiries
            </h2>
            <p>
              If you have any questions or feedback regarding this demo system, please contact the development team directly via the official project repository.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6 text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2026 BHARAT 3D Prototype. All rights reserved.</div>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/terms')} className="hover:text-slate-900">Terms of Service</button>
            <span>•</span>
            <button onClick={() => navigate('/')} className="hover:text-slate-900">Home</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
