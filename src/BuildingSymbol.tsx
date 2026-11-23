import { Item, Point } from './model';
import { doorLeaves } from './doorGeometry';

export default function BuildingSymbol({ item, selected, scale, profile }: {
    item: Item; profile?: Point[];
    selected: boolean;
    scale: number;
}) {
    const { w, d } = item, stroke = selected ? '#b67523' : '#4a5d54', line = (selected ? 2 : 1.2) / scale;
    if (item.kind === 'wall' || item.kind === 'partition')
        return <g>
            {item.kind === 'wall' && profile ? (
                <>
                    <polygon points={profile.map(p => `${p.x},${p.y}`).join(' ')} fill="#c6c2b8" />
                    <path d={`M ${profile[0].x} ${profile[0].y} L ${profile[3].x} ${profile[3].y} M ${profile[1].x} ${profile[1].y} L ${profile[2].x} ${profile[2].y} ${profile[0].x === -w / 2 && profile[1].x === -w / 2 ? `M ${-w / 2} ${-d / 2} V ${d / 2}` : ''} ${profile[2].x === w / 2 && profile[3].x === w / 2 ? `M ${w / 2} ${-d / 2} V ${d / 2}` : ''}`} fill="none" stroke={stroke} strokeWidth={line} />
                </>
            ) : (
                <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={item.kind === 'wall' ? '#b8b5ac' : item.model === 'glass-partition' ? '#badce780' : item.color} stroke={stroke} strokeWidth={line} />
            )}
            <path data-ui="true" d={`M ${-w / 2} 0 H ${w / 2}`} stroke="transparent" strokeWidth={Math.max(d, 16 / scale)} fill="none" pointerEvents="stroke" />
        </g>;

    const sign = item.flipped ? -1 : 1;
    const isStorefront = item.model === 'storefront-window';
    const isServing = item.model === 'serving-window';
    const isGlassDoor = item.model === 'glass-double-door';
    return <g>
        <rect x={-w / 2} y={-d / 2 - 1 / scale} width={w} height={d + 2 / scale} fill="#fff" stroke={selected ? '#b67523' : 'none'} strokeWidth={line} />
        {item.kind === 'window' ? (
            isServing ? (
                <>
                    <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#f7efe3" stroke={stroke} strokeWidth={line} strokeDasharray={`${6 / scale} ${4 / scale}`} />
                    <path d={`M ${-w / 2} 0 H ${w / 2}`} stroke="#b67d39" strokeWidth={line * 1.4} />
                </>
            ) : isStorefront ? (
                <>
                    <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#a8d4df55" stroke={selected ? '#b67523' : '#2d5866'} strokeWidth={line * 1.3} />
                    <path d={`M ${-w / 2} ${-d * 0.16} H ${w / 2} M ${-w / 2} ${d * 0.16} H ${w / 2}`} fill="none" stroke="#2d5866" strokeWidth={line * 1.2} />
                </>
            ) : (
                <>
                    <path d={`M ${-w / 2} ${-d / 3} H ${w / 2} M ${-w / 2} ${d / 3} H ${w / 2} ${item.model === 'fixed-window' ? '' : `M 0 ${-d / 2} V ${d / 2}`}`} fill="none" stroke="#638e9e" strokeWidth={line} />
                    <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#9ac9d533" stroke={stroke} strokeWidth={line} />
                </>
            )
        ) : (
            <>
                {doorLeaves(item).map(leaf => (
                    <path
                        key={leaf.hinge}
                        data-door-leaf="true"
                        d={`M ${leaf.hinge} 0 L ${leaf.hinge} ${sign * leaf.width} M ${leaf.hinge + leaf.direction * leaf.width} 0 A ${leaf.width} ${leaf.width} 0 0 ${sign * leaf.direction > 0 ? 1 : 0} ${leaf.hinge} ${sign * leaf.width}`}
                        stroke={isGlassDoor && !selected ? '#2d6272' : stroke}
                        strokeWidth={line * (isGlassDoor ? 1.35 : 1)}
                        fill="none"
                    />
                ))}
                <path d={`M ${-w / 2} ${-d / 2} V ${d / 2} M ${w / 2} ${-d / 2} V ${d / 2}`} stroke={stroke} strokeWidth={3 / scale} />
            </>
        )}
        <rect data-ui="true" x={-w / 2} y={-Math.max(d / 2, 6 / scale)} width={w} height={Math.max(d, 12 / scale)} fill="transparent" />
    </g>;
}
