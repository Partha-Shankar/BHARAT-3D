import React from 'react';
import type { BuildingDetail, XY } from '../../world/sceneSpec';

const ROOM_FILL: Record<string, string> = {
  living: '#fde68a', bed: '#bfdbfe', kitchen: '#fecaca', bath: '#a5f3fc', shop: '#ddd6fe', store: '#e5e7eb',
  work: '#d9f99d', office: '#c7d2fe', hall: '#fbcfe8',
};

type Floor = BuildingDetail['floors'][number];

/** 2D architectural plan of one floor, north up, drawn to fit the panel. */
export const FloorPlanSvg: React.FC<{ footprint: XY[]; floor: Floor; selected: number | null; onSelect: (i: number) => void }> = ({
  footprint, floor, selected, onSelect,
}) => {
  const W = 320, H = 230, pad = 10;
  const xs = footprint.map((p) => p[0]), ys = footprint.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const k = Math.min((W - 2 * pad) / (maxx - minx || 1), (H - 2 * pad) / (maxy - miny || 1));
  const ox = (W - (maxx - minx) * k) / 2, oy = (H - (maxy - miny) * k) / 2;
  const pt = ([x, y]: XY) => `${(ox + (x - minx) * k).toFixed(1)},${(oy + (maxy - y) * k).toFixed(1)}`;
  const poly = (ring: XY[]) => ring.map(pt).join(' ');
  const cen = (ring: XY[]): [number, number] => {
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    return [ox + (c[0] - minx) * k, oy + (maxy - c[1]) * k];
  };
  const metres = (maxx - minx) > 30 ? 10 : 5;

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full bg-white rounded-lg">
      <polygon points={poly(footprint)} fill="#f1f5f9" stroke="#0f172a" strokeWidth={3} />
      {floor.corridor && <polygon points={poly(floor.corridor)} fill="#cbd5e1" stroke="none" />}
      {floor.units.map((u, i) => (
        <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
          {u.rooms.map((r, j) => (
            <polygon key={j} points={poly(r.polygon)} fill={ROOM_FILL[r.type] ?? '#e5e7eb'} stroke="#475569" strokeWidth={0.8} />
          ))}
          <polygon points={poly(u.polygon)} fill={selected === i ? 'rgba(250,204,21,0.35)' : u.status === 'PENDING' ? 'rgba(239,68,68,0.25)' : 'transparent'}
            stroke="#0f172a" strokeWidth={selected === i ? 2.5 : 1.6} />
          {(() => {
            const [cx, cy] = cen(u.polygon);
            return <text x={cx} y={cy} fontSize={9} fontWeight={700} textAnchor="middle" fill="#0f172a">{u.unit_no}</text>;
          })()}
          {selected === i && u.rooms.map((r, j) => {
            const [cx, cy] = cen(r.polygon);
            return <text key={`t${j}`} x={cx} y={cy + 10} fontSize={6.5} textAnchor="middle" fill="#334155">{r.name}</text>;
          })}
        </g>
      ))}
      {floor.core && (() => {
        const [cx, cy] = cen(floor.core!);
        return (
          <g>
            <polygon points={poly(floor.core!)} fill="#64748b" stroke="#0f172a" strokeWidth={1.2} />
            <text x={cx} y={cy + 3} fontSize={7} textAnchor="middle" fill="#fff">Stair + lift</text>
          </g>
        );
      })()}
      <g transform={`translate(${W - 22},${16})`}>
        <path d="M0,-10 L5,4 L0,1 L-5,4 Z" fill="#ef4444" />
        <text y={14} fontSize={8} textAnchor="middle" fill="#0f172a">N</text>
      </g>
      <g transform={`translate(${pad},${H + 8})`}>
        <rect width={metres * k} height={3} fill="#0f172a" />
        <text x={metres * k + 4} y={4} fontSize={8} fill="#0f172a">{metres} m</text>
      </g>
    </svg>
  );
};

export default FloorPlanSvg;
