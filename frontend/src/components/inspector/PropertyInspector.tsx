import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Building2,
  Layers,
  Home,
  ShoppingBag,
  Train,
  AlertTriangle,
  FileText,
  Key,
  DollarSign,
  Maximize2,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Droplets,
  Radio
} from 'lucide-react';

interface PropertyInspectorProps {
  entity: any | null;
  selectedFloorNumber: number | null;
  selectedUnitId: string | null;
  onSelectFloor: (floor: number) => void;
  onSelectUnit: (unitId: string) => void;
  onOpenExploder: () => void;
  onClose: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  entity,
  selectedFloorNumber = 8,
  selectedUnitId = 'VPR-BLD0101-F08-U04',
  onSelectFloor,
  onSelectUnit,
  onOpenExploder,
  onClose,
}) => {
  if (!entity) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full space-y-3">
        <Building2 className="w-8 h-8 text-slate-300" />
        <p className="font-semibold text-slate-600">Select any 2D parcel or 3D volumetric structure</p>
        <p className="text-[11px] text-slate-400 max-w-xs">
          Inspect 3D building envelopes, floor stratification, apartment units, mall stores, flyovers, tunnels, and municipal compliance.
        </p>
      </div>
    );
  }

  const isTower = entity.id?.includes('01') || entity.name?.includes('Aarav') || entity.name?.includes('Tower');
  const isMall = entity.id?.includes('03') || entity.name?.includes('Mall') || entity.entity_type === 'mall';
  const isViolation = entity.id?.includes('07') || entity.name?.includes('Sharma') || entity.entity_type === 'violation' || entity.name?.includes('Violation');
  const isFlyover = entity.id?.includes('FLY') || entity.asset_type === 'FLYOVER' || entity.entity_type === 'flyover';
  const isTunnel = entity.id?.includes('TNL') || entity.asset_type === 'TUNNEL' || entity.entity_type === 'tunnel';
  const isUtility = entity.id?.includes('UTL') || entity.asset_type === 'TELECOM' || entity.asset_type === 'WATER' || entity.asset_type === 'ELECTRICITY';

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            3D Spatial Cadastre Inspector
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs">
        {/* Entity Primary Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{entity.name}</h4>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {entity.id}</div>
            </div>
            <Badge variant={isViolation ? 'danger' : 'success'}>
              {isViolation ? 'Violation Flagged' : 'Certified 3D Model'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1.5 border-t border-slate-200">
            <div>Base ULPIN: <strong className="font-mono text-slate-900">{entity.ulpin || 'IN-01-0008'}</strong></div>
            <div>Usage: <strong className="text-slate-900">{entity.usage || entity.building_type || 'RESIDENTIAL'}</strong></div>
            <div>Floors: <strong>{entity.floors || entity.total_floors || (isTower ? 12 : 4)}</strong></div>
            <div>Height: <strong className="font-mono text-slate-900">{entity.height || entity.height_meters || (isTower ? 39.0 : 18.5)}m MSL</strong></div>
          </div>
        </div>

        {/* 1. Apartment Tower: Floors & Individual Flat Subdivisions */}
        {isTower && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Vertical Floor Stack:</span>
              </span>
              <Button variant="outline" size="sm" onClick={onOpenExploder} className="text-[11px] py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
                <Maximize2 className="w-3 h-3 mr-1" />
                <span>3D Exploder</span>
              </Button>
            </div>

            {/* Sliced 12 Floor Buttons */}
            <div className="grid grid-cols-6 gap-1 font-mono text-[10px]">
              {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((flr) => (
                <button
                  key={flr}
                  onClick={() => onSelectFloor(flr)}
                  className={`py-1.5 rounded border transition-all ${
                    selectedFloorNumber === flr
                      ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-sm ring-2 ring-blue-300'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  F{flr}
                </button>
              ))}
            </div>

            {/* Individual Subdivided Flats on Selected Floor */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-slate-800 text-[11px] flex justify-between items-center">
                <span>Floor {selectedFloorNumber || 8} Subdivided Units (Z: 237.7m - 241.0m MSL):</span>
                <span className="text-[10px] text-blue-600 font-mono">4 Units</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[1, 2, 3, 4].map((u) => {
                  const unitCode = `VPR-BLD0101-F0${selectedFloorNumber || 8}-U0${u}`;
                  const isUnitActive = selectedUnitId === unitCode || (selectedFloorNumber === 8 && u === 4);
                  return (
                    <button
                      key={u}
                      onClick={() => onSelectUnit(unitCode)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isUnitActive
                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-2 ring-amber-200 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>Flat {(selectedFloorNumber || 8) * 100 + u}</span>
                        {u === 4 && selectedFloorNumber === 8 && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-bold">CITIZEN</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">115.2 m² • 345.6 m³</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flat 804 Selected 3D Space Registry Card */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2.5 shadow-lg border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-amber-400 font-bold text-xs">
                  {selectedUnitId || 'VPR-BLD0101-F08-U04'}
                </span>
                <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700">
                  COMPLIANT
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>Carpet Area: <strong className="text-white">94.5 m² (1,017 sq.ft)</strong></div>
                <div>Built-up Area: <strong className="text-white">115.2 m² (1,240 sq.ft)</strong></div>
                <div>Volume: <strong className="text-white">345.6 m³</strong></div>
                <div>Elevation (z_min/z_max): <strong className="font-mono text-white">237.7m - 241.0m</strong></div>
                <div>Owner: <strong className="text-amber-300">Priya Mehta</strong></div>
                <div>Occupancy: <strong className="text-white">Leased (Tenant: Rohan Gupta)</strong></div>
                <div>Annual Tax: <strong className="text-emerald-400">₹18,400 (Paid)</strong></div>
                <div>Title Deed: <strong className="font-mono text-slate-300">DEED-DL-2024-0981</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Commercial Mall Stores Breakdown */}
        {isMall && (
          <div className="space-y-3">
            <div className="font-bold text-slate-800 flex items-center space-x-1.5">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>Commercial Retail Leases & Food Court:</span>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Store S-101 (Anchor Hypermarket)</span>
                  <Badge variant="success">Active Lease</Badge>
                </div>
                <div className="text-[11px] text-slate-600">
                  Tenant: <strong>Apex Retail Supermarket</strong> • Period: 2024–2027
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Carpet: 1,200 m² • Tax: ₹1,45,000 / yr • Paid
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Store S-201 (Fashion Retail)</span>
                  <Badge variant="success">Active Lease</Badge>
                </div>
                <div className="text-[11px] text-slate-600">
                  Tenant: <strong>FabIndia Living</strong> • Period: 2024–2026
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Carpet: 320 m² • Tax: ₹48,000 / yr • Paid
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Store S-202 (Footwear Store)</span>
                  <Badge variant="warning">Expired Lease</Badge>
                </div>
                <div className="text-[11px] text-slate-600">
                  Tenant: <strong>Bata India Ltd</strong> • Expired: Dec 2025
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Carpet: 210 m² • Renewal Pending
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Store S-203 (Retail Space)</span>
                  <Badge variant="neutral">Vacant</Badge>
                </div>
                <div className="text-[11px] text-slate-500">
                  Available for Commercial Stratified Lease
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Flyover Infrastructure */}
        {isFlyover && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-2 text-orange-950">
            <div className="font-bold flex items-center space-x-1.5 text-orange-900">
              <span>🌉 Elevated Infrastructure Asset</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>Deck Elevation: <strong className="font-mono text-orange-900">+8.5m MSL</strong></div>
              <div>Deck Top: <strong className="font-mono text-orange-900">+10.7m MSL</strong></div>
              <div>Length: <strong>340 meters</strong></div>
              <div>Support Piers: <strong>6 Solid Piers (0 to 8.5m)</strong></div>
              <div>Operator: <strong>PWD Delhi / NHAI</strong></div>
              <div>Associated Road: <strong>Central Urban Spine</strong></div>
            </div>
          </div>
        )}

        {/* 4. Subsurface Tunnels & Underground Parking */}
        {isTunnel && (
          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl space-y-2 text-cyan-950">
            <div className="font-bold flex items-center space-x-1.5 text-cyan-900">
              <span>🚇 Subterranean Infrastructure</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>Depth BGL: <strong className="font-mono text-cyan-900">{entity.depth_meters || 14.2}m BGL</strong></div>
              <div>Tunnel Length: <strong>{entity.length_meters || 380} meters</strong></div>
              <div>Width / Diameter: <strong>10.0 meters</strong></div>
              <div>Operator: <strong>{entity.operator || 'DMRC'}</strong></div>
              <div>Structural Status: <strong>Watertight • Operational</strong></div>
              <div>Vertical Clash Clearance: <strong className="text-emerald-700">14.2m MSL (Safe)</strong></div>
            </div>
          </div>
        )}

        {/* 5. Subterranean Utilities */}
        {isUtility && (
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="font-bold flex items-center space-x-1.5 text-cyan-400">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Underground Utility Network Asset</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>Asset ID: <strong className="font-mono text-white">{entity.id}</strong></div>
              <div>Depth BGL: <strong className="font-mono text-cyan-300">{entity.depth_meters || 1.8}m</strong></div>
              <div>Operator: <strong className="text-white">{entity.operator || 'BSNL / DJB'}</strong></div>
              <div>Corridor Status: <strong className="text-emerald-400">OPERATIONAL</strong></div>
            </div>
          </div>
        )}

        {/* 6. Physical 3D Violations */}
        {isViolation && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2.5 text-red-950">
            <div className="flex items-center space-x-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Municipal Compliance Violation</span>
            </div>
            <div className="text-[11px] text-red-900 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-red-200">
              <strong>Sharma Commercial Plaza</strong> measured at <strong>G+6 (21.2m)</strong> vs sanctioned limit of <strong>G+4 (14.0m)</strong>.
              The 2 unauthorized upper floors (Floors 5 & 6) are physically rendered in warning RED.
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-red-800 pt-1">
              <div>Rule: UBBL 2016 Cl. 4.2</div>
              <div>Penalty: ₹84,000 / yr</div>
              <div>Front Setback: 3.8m (Req 6.0m)</div>
              <div>Status: Notice Pending</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
