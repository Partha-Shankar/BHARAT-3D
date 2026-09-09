import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Home, Receipt, ShieldCheck, Box, FileText, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Citizen 3D Property & Ownership Portal
            </h1>
            <Badge variant="success" size="sm">
              DPDP Verified
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authenticated Citizen: <span className="font-semibold text-slate-800">{user?.full_name || 'Priya Mehta'}</span> • Masked ID: <span className="font-mono text-slate-600">ID-XXXX-8921</span>
          </p>
        </div>
      </div>

      {/* Privacy Guarantee Alert */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">
            <strong>Data Minimization Active:</strong> Only certified 3D properties legally bound to your national identity hash are visible. Open browsing of other citizens' land records is restricted.
          </p>
        </div>
      </div>

      {/* My Property Registered Card */}
      <div className="bg-white rounded-xl border-2 border-navy-900 shadow-xl overflow-hidden">
        <div className="bg-navy-950 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 text-accent-400 text-xs font-mono font-bold mb-1">
              <span>3D PROPERTY ID: VPR-BLD001-F08-U04</span>
            </div>
            <h2 className="text-lg font-bold text-white">Flat 804, Aarav Heights Condominium</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Floor 8 • Ward 16, Central Urban Zone • Base Cadastral ULPIN: <span className="font-mono text-slate-300">IN-DEMO-0042</span>
            </p>
          </div>

          <Button variant="accent" size="md" className="shadow">
            <Box className="w-4 h-4 mr-2" />
            <span>Flyto 3D Unit in Cesium</span>
          </Button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Spatial Volume Specs */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
              <Home className="w-4 h-4 text-navy-900" />
              <span>Volumetric Spatial Extent</span>
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Carpet Area:</span>
                <strong className="text-slate-900">115.2 m² (1,240 sq.ft)</strong>
              </div>
              <div className="flex justify-between">
                <span>Enclosed Volume:</span>
                <strong className="text-slate-900">345.6 m³</strong>
              </div>
              <div className="flex justify-between">
                <span>Elevation Level:</span>
                <strong className="text-slate-900">239.0m - 242.0m MSL</strong>
              </div>
              <div className="flex justify-between">
                <span>Undivided Land Share:</span>
                <strong className="text-slate-900">4.16%</strong>
              </div>
            </div>
          </div>

          {/* Legal Ownership Title */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Legal Title & Ownership</span>
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Title Deed No:</span>
                <strong className="text-slate-900 font-mono">DEED-DL-2024-0981</strong>
              </div>
              <div className="flex justify-between">
                <span>Owner:</span>
                <strong className="text-slate-900">Priya Mehta</strong>
              </div>
              <div className="flex justify-between">
                <span>Ownership Type:</span>
                <strong className="text-slate-900">Freehold Title (100%)</strong>
              </div>
              <div className="flex justify-between">
                <span>Registration Date:</span>
                <strong className="text-slate-900">15 April 2024</strong>
              </div>
            </div>
          </div>

          {/* Tenancy & Tax Roll */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
              <Receipt className="w-4 h-4 text-blue-700" />
              <span>Occupancy & Municipal Tax</span>
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Occupancy Status:</span>
                <Badge variant="accent">Leased to Tenant</Badge>
              </div>
              <div className="flex justify-between">
                <span>Active Tenant:</span>
                <strong className="text-slate-900">Rohan Gupta</strong>
              </div>
              <div className="flex justify-between">
                <span>Annual Tax Assessment:</span>
                <strong className="text-emerald-700 font-mono font-bold">₹18,400</strong>
              </div>
              <div className="flex justify-between">
                <span>Payment Status:</span>
                <span className="text-emerald-600 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Paid in Full
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
