import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, ShieldAlert, Scale, ArrowRight, Download } from 'lucide-react';

export const ViolationsPage: React.FC = () => {
  const violations = [
    {
      code: 'VLT-001',
      building: 'Sharma Commercial Plaza (BLD-007)',
      type: 'UNAUTHORIZED_EXTRA_FLOORS',
      severity: 'CRITICAL',
      sanctioned: 'G + 4 (15.0m)',
      observed: 'G + 6 (21.2m)',
      excess: '2 Unauthorized Upper Floors',
      bylaw: 'NBC 2016 Part 3 Cl. 4.2',
      status: 'OPEN_NOTICE_ISSUED',
    },
    {
      code: 'VLT-002',
      building: 'Sharma Commercial Plaza (BLD-007)',
      type: 'FRONT_SETBACK_BREACH',
      severity: 'HIGH',
      sanctioned: '6.0 meters required',
      observed: '3.8 meters observed',
      excess: '2.2 meters front breach',
      bylaw: 'Master Plan Zonal Regulations Cl. 7',
      status: 'OPEN_NOTICE_ISSUED',
    },
    {
      code: 'VLT-003',
      building: 'Mehta Commercial Complex (BLD-008)',
      type: 'FOOTPATH_ENCROACHMENT',
      severity: 'MEDIUM',
      sanctioned: '0.0 m² public ROW',
      observed: '18.6 m² occupied',
      excess: '18.6 m² public sidewalk',
      bylaw: 'Municipal Road Encroachment Act Sec. 32',
      status: 'UNDER_REVIEW',
    },
    {
      code: 'VLT-004',
      building: 'Aarav Heights Rooftop (BLD-001)',
      type: 'ILLEGAL_ROOFTOP_STRUCTURE',
      severity: 'LOW',
      sanctioned: 'Open Terrace Only',
      observed: '42 m² tin shed',
      excess: '42 m² unapproved coverage',
      bylaw: 'Fire & Safety Byelaw Sec. 9',
      status: 'COMPOUNDABLE',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Municipal Bylaw Compliance & Violation Registry
            </h1>
            <Badge variant="danger" size="sm">
              18 Violations Detected
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated 3D spatial comparison of observed sensor geometry against municipal master plan bylaws.
          </p>
        </div>

        <Button variant="outline" size="sm">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          <span>Export Compliance Audit (PDF)</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-xs font-bold text-red-900">Unauthorized Floors ($G+N$)</div>
          <div className="text-2xl font-bold text-red-700 mt-1">4 Buildings</div>
          <p className="text-[10px] text-red-600 mt-0.5">Exceeds sanctioned building permission limits</p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-xs font-bold text-amber-900">Setback Breaches (Front/Rear/Side)</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">9 Properties</div>
          <p className="text-[10px] text-amber-600 mt-0.5">Infringes upon mandatory open space buffers</p>
        </div>

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="text-xs font-bold text-orange-900">Footpath / ROW Encroachments</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">5 Cases</div>
          <p className="text-[10px] text-orange-600 mt-0.5">Structures projecting into public right-of-way</p>
        </div>
      </div>

      {/* Violations Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Violation Code & Building</th>
                <th className="py-3 px-4 text-left">Violation Category</th>
                <th className="py-3 px-4 text-left">Permitted / Sanctioned</th>
                <th className="py-3 px-4 text-left">Observed 3D Measure</th>
                <th className="py-3 px-4 text-left">Violation Magnitude</th>
                <th className="py-3 px-4 text-left">Severity</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {violations.map((v, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-red-700">{v.code}</div>
                    <div className="font-semibold text-slate-900">{v.building}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">{v.type}</td>
                  <td className="py-3 px-4 text-slate-600">{v.sanctioned}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{v.observed}</td>
                  <td className="py-3 px-4 font-bold text-red-600">{v.excess}</td>
                  <td className="py-3 px-4">
                    <Badge variant={v.severity === 'CRITICAL' || v.severity === 'HIGH' ? 'danger' : 'warning'}>
                      {v.severity}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border">
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
