import type { FloorMaterial } from './model';

export default function PlanFloorPattern({ material }: { material: FloorMaterial }) {
  const tile = material === 'checker' ? 2000 : material === 'oak-wood' ? 1200 : 600;
  const base = { checker: '#e7e8e0', 'oak-wood': '#e9d6b5', terrazzo: '#f0ece3', 'warm-tile': '#f0e4d2', concrete: '#e9e8e3' }[material];
  return <pattern id="plan-floor" patternUnits="userSpaceOnUse" width={tile} height={tile} data-material={material}>
    <rect width={tile} height={tile} fill={base}/>
    {material === 'checker' && <path d="M1000 0H2000V1000H1000Z M0 1000H1000V2000H0Z" fill="#dbe0d6"/>}
    {material === 'warm-tile' && <path d="M0 600V0H600" fill="none" stroke="#d0c4b1" strokeWidth="5"/>}
    {material === 'oak-wood' && <g fill="none" stroke="#ccba9c" strokeWidth="3">
      <path d="M0 1H1200 M0 200H1200 M0 400H1200 M0 600H1200 M0 800H1200 M0 1000H1200"/>
      <path d="M1 0V200 M480 200V400 M880 400V600 M220 600V800 M680 800V1000 M380 1000V1200"/>
    </g>}
    {material === 'terrazzo' && <path d="m40 65 10-6 9 12-11 4z m346 56 7 2-4 10-8-5z m-198 230 6-10 8 4-5 11z m275 117 9-3 3 8-9 4z" fill="#cec9bb"/>}
  </pattern>;
}
