import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadExport } from '../world/api';

const FORMATS = [
  { fmt: 'cityjson' as const, label: 'CityJSON', title: 'CityJSON 2.0: buildings, 3D ULPIN units, parcels and utility corridors in 3D (no personal data)' },
  { fmt: 'ladm' as const, label: 'LADM', title: 'ISO 19152 LADM: spatial units, rights and shares; owners only where your role may see them' },
];

/** Download buttons for an area's open-standard exports. */
export const ExportButtons: React.FC<{ areaKey: string }> = ({ areaKey }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (fmt: 'cityjson' | 'ladm') => {
    setBusy(fmt);
    setError(null);
    try {
      await downloadExport(areaKey, fmt);
    } catch {
      setError('Export failed, try again');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      {FORMATS.map((f) => (
        <button key={f.fmt} className="b3-btn" title={f.title} disabled={!!busy} onClick={() => run(f.fmt)}>
          {busy === f.fmt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {f.label}
        </button>
      ))}
      {error && <span className="text-[11px] text-[#c0392b]">{error}</span>}
    </div>
  );
};
