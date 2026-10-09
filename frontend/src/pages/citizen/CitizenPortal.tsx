import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowRight, Box, Building2, Fingerprint, Home, Loader2, Search } from 'lucide-react';
import { getBuildingDetail, searchAllRegistries } from '../../world/api';
import type { RegistryHit } from '../../world/sceneSpec';
import { EmptyState, Page, PageHeader } from '../../survey/ui';
import { ppmToPct } from '../../survey/norms';

const useDebounced = <T,>(v: T, ms = 300) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

const UnitCard: React.FC<{ hit: RegistryHit }> = ({ hit }) => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['unit', hit.key, hit.building_id], queryFn: () => getBuildingDetail(hit.key, hit.building_id) });
  const unit = data?.floors.find((f) => f.floor === hit.floor)?.units.find((u) => u.index === hit.unit_index);
  const rows: [string, React.ReactNode][] = unit ? [
    ['Floor', hit.floor === 0 ? 'Ground' : `Floor ${hit.floor}`], ['Unit', unit.unit_no], ['Built-up / carpet', `${unit.built_up_m2} / ${unit.carpet_m2} m²`],
    ['Rooms', unit.rooms.map((r) => r.name).join(', ')], ['Volume', `${unit.volume_m3} m³`], ['Height band', `${unit.h_min ?? unit.z_min} – ${unit.h_max ?? unit.z_max} m above ground`],
    ['Undivided land share', ppmToPct(unit.uds_ppm)], ['Owner on record', unit.owner], ['Annual property tax', `₹${unit.annual_tax_inr.toLocaleString('en-IN')}`],
  ] : [];
  return (
    <div className="b3-card overflow-hidden b3-drawer">
      <div className="bg-[#1e4d6b] text-[#f3efe6] p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8fd0c8]">{hit.place}</div>
        <div className="b3-serif text-2xl mt-1">{hit.building_name}</div>
        <div className="font-mono text-[15px] text-[#f2c46a] mt-2 break-all">{hit.vprid ?? 'No 3D identity issued'}</div>
        <div className="text-[11.5px] text-[#d5e3ea] mt-1">Parent parcel ULPIN <span className="font-mono">{hit.ulpin}</span></div>
      </div>
      <div className="p-5 space-y-3">
        {isLoading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="b3-skel h-5" />)}</div> : (
          <div className="b3-stagger">{rows.map(([k, v]) => <div key={k} className="b3-row"><span>{k}</span><span className="font-medium text-right">{v}</span></div>)}</div>
        )}
        <p className="text-[11px] text-[#7a4f86]">Owner, tax and title details are demonstration records generated for this prototype.</p>
        <button className="w-full b3-btn b3-btn-primary !py-2.5" onClick={() => navigate(`/3d-world/${hit.key}?building=${encodeURIComponent(hit.building_id)}&floor=${hit.floor}&unit=${hit.unit_index}`)}>
          <Box className="w-4 h-4" /> See my unit in 3D <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/** Citizen portal: find your unit by its 3D ULPIN, the parcel ULPIN or the building name. */
export const CitizenPortal: React.FC = () => {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const [sel, setSel] = useState<RegistryHit | null>(null);
  const { data, isFetching } = useQuery({
    queryKey: ['citizen-search', dq],
    queryFn: () => searchAllRegistries(dq, 30, ''),
    enabled: dq.length >= 3,
    placeholderData: keepPreviousData,
  });
  const hits = (data?.items ?? []).filter((h) => h.vprid);

  return (
    <Page>
      <PageHeader eyebrow="Citizen services" title="My property in 3D"
        lead="Find your flat, shop or office by its 3D ULPIN (VPRID), your parcel's ULPIN, or the building name. See its volume, height band, undivided share and tax, and where it sits in the building." />

      <div className="b3-card p-5 b3-rise b3-d3">
        <div className="relative">
          <Search className="w-5 h-5 text-[#7d8c97] absolute left-3 top-1/2 -translate-y-1/2" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="e.g. KA232C3EMBDLHY-BL01-L08-U804, a 14-character ULPIN, or a building name"
            className="b3-input !pl-10 !py-3 !text-[14px]" />
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-[#1f7a72] absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-[11.5px] text-[#7d8c97]">
          <span className="flex items-center gap-1"><Fingerprint className="w-3.5 h-3.5" /> 3D ULPIN</span>·
          <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> parcel ULPIN</span>·
          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> building name</span>
        </div>
      </div>

      {sel ? (
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-5 items-start">
          <button className="b3-btn self-start" onClick={() => setSel(null)}>← Back to results</button>
          <UnitCard key={`${sel.key}${sel.vprid}`} hit={sel} />
        </div>
      ) : dq.length < 3 ? (
        <EmptyState icon={<Fingerprint className="w-6 h-6" />} title="Search for your property">
          Type at least three characters. Your 3D ULPIN is printed on the property record of your flat or shop.
        </EmptyState>
      ) : hits.length === 0 && !isFetching ? (
        <EmptyState title="No property found">Check the identifier, or try the building name.</EmptyState>
      ) : (
        <div className="grid gap-2 b3-stagger" key={dq}>
          {hits.map((h) => (
            <button key={`${h.key}${h.vprid}`} onClick={() => setSel(h)} className="b3-card is-hoverable p-3.5 text-left flex items-center gap-3 group">
              <span className="w-9 h-9 rounded-xl bg-[#c8962e]/12 text-[#8a5a12] flex items-center justify-center shrink-0"><Fingerprint className="w-4 h-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[12.5px] font-semibold text-[#8a5a12] truncate">{h.vprid}</span>
                <span className="block text-[11.5px] text-[#5c6e7c] truncate">{h.building_name} · {h.floor === 0 ? 'Ground floor' : `Floor ${h.floor}`} · unit {h.unit_no} · {h.place}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-[#9aa6ae] transition-transform duration-500 group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      )}
    </Page>
  );
};

export default CitizenPortal;
