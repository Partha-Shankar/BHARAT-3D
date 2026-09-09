import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { History, ShieldCheck, Download } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const auditLogs = [
    {
      id: 'LOG-9481',
      user: 'Rajesh Kumar (Surveyor ID: SRV-104)',
      action: 'CERTIFIED_3D_CADASTRE',
      entity: 'Project: Central Urban Zone (v3.0)',
      diff: 'Generated 884 Volumetric Property Identifiers (VPRIDs)',
      timestamp: '2026-09-09T10:45:12Z',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      id: 'LOG-9480',
      user: 'Rajesh Kumar (Surveyor ID: SRV-104)',
      action: 'MODIFY_TUNNEL_ALIGNMENT',
      entity: 'Asset: TNL-001 (Central Urban Tunnel)',
      diff: 'Length updated from 320m to 350m based on GPR survey',
      timestamp: '2026-09-09T10:42:05Z',
      hash: 'a89104fa289c0918e91841029481a89c0918e91841029481a89104fa289c0918',
    },
    {
      id: 'LOG-9479',
      user: 'Rajesh Kumar (Surveyor ID: SRV-104)',
      action: 'ADD_FLOOR_AND_SPLIT',
      entity: 'Building: BLD-001 (Aarav Heights)',
      diff: 'Added Floor 13, partitioned into units U1301 - U1304',
      timestamp: '2026-09-09T10:39:18Z',
      hash: '7190412840918491829418491829418471904128409184918294184918294184',
    },
    {
      id: 'LOG-9478',
      user: 'System AI Pipeline',
      action: 'BYLAW_VIOLATION_DETECTED',
      entity: 'Building: BLD-007 (Sharma Complex)',
      diff: 'Flagged 2 unauthorized upper floors ($G+6$ vs $G+4$)',
      timestamp: '2026-09-09T10:31:00Z',
      hash: '0918491829418491829418491829418409184918294184918294184918294184',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Cryptographic Cadastral Audit Trail
            </h1>
            <Badge variant="success" size="sm">
              SHA-256 Non-Repudiation Active
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of all spatial edits, bylaw flags, and title changes with cryptographic checksum verification.
          </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Log ID & User</th>
                <th className="py-3 px-4 text-left">Action</th>
                <th className="py-3 px-4 text-left">Target Entity</th>
                <th className="py-3 px-4 text-left">Modification Details</th>
                <th className="py-3 px-4 text-left">Timestamp</th>
                <th className="py-3 px-4 text-right">SHA-256 Digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-navy-950">{log.id}</div>
                    <div className="text-[11px] text-slate-600">{log.user}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-semibold text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{log.entity}</td>
                  <td className="py-3 px-4 text-slate-600 text-[11px]">{log.diff}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                    {log.hash.slice(0, 16)}...
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
