import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../stores/appStore';
import api from '../../lib/api';
import {
  FileCheck2,
  Building2,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Archive,
  RefreshCw,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const RegistryPage: React.FC = () => {
  const { selectedAreaId } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [registryStatus, setRegistryStatus] = useState<string>('ACTIVE_CERTIFIED');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Registry Records
  const registryItems = [
    {
      vprid: 'VPR-BLD0101-F08-U04',
      ulpin: 'IN-01-0008',
      building: 'Aarav Heights Tower',
      unit: 'Flat 804',
      floor: 'Floor 8',
      type: 'RESIDENTIAL',
      area: '115.2 m²',
      volume: '345.6 m³',
      owner: 'Priya Mehta',
      occupancy: 'Leased (Rohan Gupta)',
      tax: '₹18,400',
      status: 'CERTIFIED',
    },
    {
      vprid: 'VPR-BLD0101-F08-U01',
      ulpin: 'IN-01-0008',
      building: 'Aarav Heights Tower',
      unit: 'Flat 801',
      floor: 'Floor 8',
      type: 'RESIDENTIAL',
      area: '115.2 m²',
      volume: '345.6 m³',
      owner: 'Rajesh Kumar Sharma',
      occupancy: 'Self-Occupied',
      tax: '₹18,400',
      status: 'CERTIFIED',
    },
    {
      vprid: 'VPR-BLD0101-F12-U01',
      ulpin: 'IN-01-0008',
      building: 'Aarav Heights Tower',
      unit: 'Penthouse Duplex 1201',
      floor: 'Floor 12',
      type: 'DUPLEX_PENTHOUSE',
      area: '230.4 m²',
      volume: '691.2 m³',
      owner: 'Kavita Krishnamurthy',
      occupancy: 'Owner-Occupied',
      tax: '₹32,000',
      status: 'CERTIFIED',
    },
    {
      vprid: 'VPR-BLD0103-F01-S01',
      ulpin: 'IN-01-0003',
      building: 'Civic Grand Mall',
      unit: 'Store S-101 (Anchor Hypermarket)',
      floor: 'Level 1',
      type: 'COMMERCIAL',
      area: '1,200.0 m²',
      volume: '5,520.0 m³',
      owner: 'Civic Grand Mall Ltd',
      occupancy: 'Leased (Apex Retail)',
      tax: '₹1,45,000',
      status: 'CERTIFIED',
    },
    {
      vprid: 'VPR-BLD0103-F02-S02',
      ulpin: 'IN-01-0003',
      building: 'Civic Grand Mall',
      unit: 'Store S-202 (Footwear Outlet)',
      floor: 'Level 2',
      type: 'COMMERCIAL',
      area: '210.0 m²',
      volume: '966.0 m³',
      owner: 'Civic Grand Mall Ltd',
      occupancy: 'Expired Lease (Bata India)',
      tax: '₹32,000',
      status: 'CERTIFIED',
    },
    {
      vprid: 'VPR-BLD0104-F01-S01',
      ulpin: 'IN-01-0001',
      building: 'Central Junction Station',
      unit: 'Railway Commercial Shop 01',
      floor: 'Platform Concourse',
      type: 'COMMERCIAL',
      area: '45.0 m²',
      volume: '180.0 m³',
      owner: 'Northern Railways',
      occupancy: 'Leased (IRCTC Vendor)',
      tax: '₹12,000',
      status: 'CERTIFIED',
    },
  ];

  const handleArchive = () => {
    setRegistryStatus('ARCHIVED_HISTORICAL');
    setActionNotice('3D Cadastral Registry snapshot archived. Historical version preserved.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRegenerate = () => {
    setRegistryStatus('ACTIVE_CERTIFIED');
    setActionNotice('3D Cadastral Registry active state restored and re-certified.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const filtered = registryItems.filter(
    (item) =>
      item.vprid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              3D Cadastral Property & Infrastructure Registry
            </h1>
            <Badge variant={registryStatus === 'ACTIVE_CERTIFIED' ? 'success' : 'warning'} size="sm">
              {registryStatus === 'ACTIVE_CERTIFIED' ? 'Certified Active v3.0' : 'Archived Historical'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official linked land roll decoupling volumetric polyhedra (`VPRID`) from Legal Ownership Deeds, Municipal Property Tax, and Tenancy Occupancies.
          </p>
        </div>

        {/* Bulk Archive & Regenerate Actions (Requirement 37) */}
        <div className="flex items-center space-x-2">
          {registryStatus === 'ACTIVE_CERTIFIED' ? (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
              <span>ARCHIVE 3D REGISTRY</span>
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <span>REGENERATE 3D REGISTRY</span>
            </Button>
          )}

          <Button variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export Registry (CSV)</span>
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex items-center space-x-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by 3D Property ID (VPRID), Base ULPIN, Building Name, or Owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </Card>

      {/* Registry Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">3D Property ID (VPRID)</th>
                <th className="py-3 px-4 text-left">Base 2D ULPIN</th>
                <th className="py-3 px-4 text-left">Building & Unit</th>
                <th className="py-3 px-4 text-left">Type & Volume</th>
                <th className="py-3 px-4 text-left">Legal Owner</th>
                <th className="py-3 px-4 text-left">Occupancy / Lease</th>
                <th className="py-3 px-4 text-left">Annual Tax</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-900">{row.vprid}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{row.ulpin}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{row.building}</div>
                    <div className="text-[11px] text-slate-500">{row.unit} ({row.floor})</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={row.type.includes('COMMERCIAL') ? 'accent' : 'info'}>{row.type}</Badge>
                    <div className="text-[10px] text-slate-500 mt-0.5">{row.area} • {row.volume}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{row.owner}</td>
                  <td className="py-3 px-4 text-slate-600">{row.occupancy}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700">{row.tax}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant="success">{row.status}</Badge>
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

export default RegistryPage;
