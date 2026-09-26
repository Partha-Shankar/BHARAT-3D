import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Scale,
  AlertOctagon,
  Receipt,
  Building2,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MunicipalDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-[#1e4d6b] p-6 rounded-sm text-white shadow-sm border border-[#173e56] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-[#8fd0c8] text-xs font-semibold uppercase tracking-wider mb-1">
            <Scale className="w-3.5 h-3.5" />
            <span>Municipality workspace</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#f3efe6]">
            Municipal compliance dashboard
          </h1>
          <p className="text-xs text-[#d5e3ea] mt-1 max-w-xl">
            Audit height, setbacks, and footpath lines against the 3D registry—catch unassessed floors and encroachments before they become disputes.
          </p>
        </div>

        <Button
          variant="accent"
          size="md"
          onClick={() => navigate('/municipality/violations')}
        >
          <AlertOctagon className="w-4 h-4 mr-2" />
          <span>Audit Active Violations</span>
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assessed 3D Properties"
          value="884"
          subtitle="Tax Units Registered"
          icon={<Receipt className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Compliance Violations"
          value="18"
          subtitle="Setbacks & Extra Floors"
          icon={<AlertOctagon className="w-5 h-5 text-red-600" />}
        />
        <StatCard
          title="Annual Tax Assessed"
          value="₹1.42 Cr"
          subtitle="FY 2026-27"
          icon={<Building2 className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Footpath Encroachments"
          value="5 Areas"
          subtitle="Sidewalk Obstructions"
          icon={<Scale className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Critical Violation Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="High-Priority Enforcement Notices"
          subtitle="Unapproved vertical construction and major setback breaches requiring statutory notice"
        >
          <div className="space-y-3">
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-red-950">
                <span>Sharma Commercial Plaza (BLD-007)</span>
                <Badge variant="danger">CRITICAL</Badge>
              </div>
              <p className="text-[11px] text-red-800">
                Unauthorized Construction: Sanctioned for G+4 (15.0m), detected as G+6 (21.2m). 2 unauthorized upper floors generating tax evasion and fire-safety risk.
              </p>
              <div className="pt-2 flex justify-between items-center text-[10px]">
                <span className="font-mono text-red-700">Setback Breach: 2.2m front encroachment</span>
                <Button variant="danger" size="sm">
                  Issue Demolition Notice
                </Button>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span>Mehta Commercial Complex (BLD-008)</span>
                <Badge variant="warning">MEDIUM</Badge>
              </div>
              <p className="text-[11px] text-amber-800">
                Footpath Encroachment: Permanent ground ramp illegally encroaches 18.6 m² into the public pedestrian right-of-way.
              </p>
              <div className="pt-2 flex justify-between items-center text-[10px]">
                <span className="font-mono text-amber-700">Fine Compounding: ₹45,000</span>
                <Button variant="outline" size="sm">
                  Issue Removal Order
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Property Tax Collection Breakdown */}
        <Card
          title="3D Property Tax Assessment Roll"
          subtitle="Automated revenue collection linked directly to verified volumetric spaces"
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <div className="font-semibold text-slate-800">Residential Apartments (720 Units)</div>
                <div className="text-[10px] text-slate-500">Aarav Heights, Sunrise Residency, Urban Heights</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900 font-mono">₹78.4 Lakhs</div>
                <div className="text-[10px] text-emerald-600 font-semibold">94.2% Paid</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <div className="font-semibold text-slate-800">Commercial Malls & Retail (112 Units)</div>
                <div className="text-[10px] text-slate-500">Civic Grand Mall Stores, Station Retail</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-900 font-mono">₹54.2 Lakhs</div>
                <div className="text-[10px] text-emerald-600 font-semibold">89.8% Paid</div>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <div className="font-semibold text-slate-800">Discovered Unassessed Vertical Space</div>
                <div className="text-[10px] text-slate-500">Extracted from LiDAR / nDSM height analysis</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-700 font-mono">₹9.8 Lakhs</div>
                <div className="text-[10px] text-red-600 font-semibold">Recovery Pending</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
