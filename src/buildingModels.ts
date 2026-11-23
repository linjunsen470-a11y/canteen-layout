import * as T from 'three';
import { Item, LightingPreset, Point, WallMaterial } from './model';
import { wallSections } from './structure';
import { doorLeaves } from './doorGeometry';
import { brushedSteelTexture, wallMaterialTexture } from './materials';

type Spec = Pick<Item, 'kind' | 'w' | 'd' | 'h' | 'color' | 'flipped' | 'hingeRight' | 'model'>;
export type BuildingRenderOptions = {
    wallMaterial?: WallMaterial;
    cutaway?: boolean;
    lightingPreset?: LightingPreset;
};

export function createBuildingModel(item: Spec, openings: Item[] = [], profile?: Point[], options: BuildingRenderOptions = {}) {
    const group = new T.Group();
    const w = item.w / 1000, d = item.d / 1000;
    const isClay = options.lightingPreset === 'clay';
    const effectiveH = item.kind === 'wall' && options.cutaway ? Math.min(item.h, 1180) : item.h;
    const h = effectiveH / 1000;

    const wallTex = !isClay && item.kind === 'wall' && options.wallMaterial ? wallMaterialTexture(options.wallMaterial) : null;
    const wallColor = isClay ? '#ecebe6' : item.color;
    const surface = new T.MeshStandardMaterial({
        color: wallColor,
        roughness: wallTex ? wallTex.roughness : 0.86,
        map: wallTex ? wallTex.map : null,
    });
    const baseboardMat = new T.MeshStandardMaterial({
        color: isClay ? '#d7d5ce' : '#534538',
        roughness: 0.55,
        metalness: 0.08,
    });
    const capMat = new T.MeshStandardMaterial({
        color: isClay ? '#dcdad2' : '#d8d2c6',
        roughness: 0.72,
    });
    const isStorefront = item.model === 'storefront-window' || item.model === 'glass-double-door';
    const frame = new T.MeshStandardMaterial({
        color: isClay ? '#d0cec6' : isStorefront ? '#2c3438' : item.kind === 'door' ? '#dfd8cb' : item.color,
        roughness: isStorefront ? 0.3 : 0.34,
        metalness: isStorefront ? 0.72 : item.kind === 'door' ? 0.1 : 0.62,
    });
    const glass = new T.MeshPhysicalMaterial({
        color: isStorefront ? '#d3e9ec' : '#c2e1e6',
        roughness: 0.08,
        transparent: true,
        opacity: isStorefront ? 0.24 : 0.3,
        metalness: 0.06,
        reflectivity: 0.75,
        depthWrite: false,
        side: T.DoubleSide,
    });
    const metal = new T.MeshStandardMaterial({
        color: '#c6cfd3',
        map: isClay ? null : brushedSteelTexture(),
        metalness: 0.84,
        roughness: 0.24,
    });
    const heatLampGlow = new T.MeshStandardMaterial({
        color: '#ffdfae',
        emissive: '#ffaa44',
        emissiveIntensity: options.lightingPreset === 'evening' ? 2.1 : options.lightingPreset === 'warm-dining' ? 1.4 : 0.6,
        roughness: 0.2,
    });

    const box = (x: number, y: number, z: number, width: number, height: number, depth: number, mat: T.Material = surface) => {
        const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = mat !== glass;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    };

    if (item.kind === 'wall') {
        const wallItem = options.cutaway ? { ...item, h: effectiveH } : item;
        const clampedOpenings = options.cutaway
            ? openings.filter(o => (o.sill ?? 0) < effectiveH - 50).map(o => ({ ...o, h: Math.min(o.h, effectiveH - (o.sill ?? 0)) }))
            : openings;
        wallSections(wallItem, clampedOpenings).forEach(s => {
            if (!profile) {
                box((s.x + s.w / 2) / 1000 - w / 2, (s.y + s.h / 2) / 1000, 0, s.w / 1000, s.h / 1000, d);
            } else {
                const left = s.x - item.w / 2, right = s.x + s.w - item.w / 2;
                const points = [
                    s.x === 0 ? profile[0] : { x: left, y: -item.d / 2 },
                    s.x === 0 ? profile[1] : { x: left, y: item.d / 2 },
                    Math.abs(s.x + s.w - item.w) < 0.01 ? profile[2] : { x: right, y: item.d / 2 },
                    Math.abs(s.x + s.w - item.w) < 0.01 ? profile[3] : { x: right, y: -item.d / 2 },
                ];
                const shape = new T.Shape(points.map(p => new T.Vector2(p.x / 1000, -p.y / 1000)));
                const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: s.h / 1000, bevelEnabled: false }), surface);
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.y = s.y / 1000;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);
            }
            // Architectural baseboard along floor-touching wall segments
            if (s.y === 0 && s.h >= 120 && s.w >= 120) {
                const bh = Math.min(0.1, s.h / 1000 * 0.4);
                box((s.x + s.w / 2) / 1000 - w / 2, bh / 2, 0, s.w / 1000, bh, d + 0.014, baseboardMat);
            }
            // Subtle architectural cut cap when cutaway view is enabled
            if (options.cutaway && s.y + s.h >= effectiveH - 10) {
                box((s.x + s.w / 2) / 1000 - w / 2, (s.y + s.h) / 1000 + 0.006, 0, s.w / 1000, 0.012, d + 0.004, capMat);
            }
        });
    } else if (options.cutaway && item.kind === 'window' && item.model !== 'storefront-window') {
        // Keep cutaway view uncluttered for high windows; render low sill ledge only
        const sillDepth = Math.max(0.06, d + 0.02);
        box(0, 0.02, 0, w, 0.04, sillDepth, frame);
    } else {
        const displayH = options.cutaway ? Math.min(h, 1.18) : h;
        const t = Math.min(0.05, w * 0.08, displayH * 0.08), depth = Math.max(0.05, d);
        box(-w / 2 + t / 2, displayH / 2, 0, t, displayH, depth, frame);
        box(w / 2 - t / 2, displayH / 2, 0, t, displayH, depth, frame);
        if (!options.cutaway) box(0, displayH - t / 2, 0, w - 2 * t, t, depth, frame);

        if (item.kind === 'window') {
            box(0, t / 2, 0, w - 2 * t, t, depth, frame);
            const iw = w - 2 * t, ih = Math.max(0.05, displayH - (options.cutaway ? t : 2 * t));
            if (item.model === 'storefront-window') {
                // Mall floor-to-ceiling commercial curtain glass with crisp dark-aluminum mullions
                const panels = Math.max(2, Math.round(w / 1.1));
                for (let n = 1; n < panels; n++) {
                    const mx = -iw / 2 + (n * iw) / panels;
                    box(mx, t + ih / 2, 0, 0.036, ih, depth * 0.55, frame);
                }
                if (displayH > 1.8 && !options.cutaway) {
                    box(0, displayH - 0.45, 0, iw, 0.036, depth * 0.55, frame);
                }
                box(0, t + ih / 2, 0, iw, ih, 0.012, glass);
            } else if (item.model === 'serving-window') {
                // Open kitchen pass-through hatch with stainless counter sill + overhead warm heat lamp bar
                box(0, t / 2 + 0.01, 0, w + 0.06, 0.04, depth + 0.24, metal);
                if (!options.cutaway) {
                    box(0, displayH - t - 0.05, 0, iw * 0.88, 0.05, 0.12, metal);
                    box(0, displayH - t - 0.08, 0, iw * 0.82, 0.02, 0.05, heatLampGlow);
                }
            } else if (item.model === 'fixed-window') {
                box(0, t + ih / 2, 0, iw, ih, 0.008, glass);
            } else {
                const sw = (iw + t) / 2, rail = Math.min(t * 0.65, 0.028), sd = Math.min(0.035, depth * 0.22);
                for (const sign of [-1, 1]) {
                    const cx = sign * (iw - sw) / 2, z = sign * depth * 0.18;
                    box(cx - sw / 2 + rail / 2, displayH / 2, z, rail, ih, sd, frame);
                    box(cx + sw / 2 - rail / 2, displayH / 2, z, rail, ih, sd, frame);
                    box(cx, t + rail / 2, z, sw - 2 * rail, rail, sd, frame);
                    if (!options.cutaway) box(cx, displayH - t - rail / 2, z, sw - 2 * rail, rail, sd, frame);
                    box(cx, displayH / 2, z, sw - 2 * rail, ih - 2 * rail, 0.008, glass);
                    box(cx - sign * (sw / 2 - rail * 1.5), displayH / 2, z + sd * 0.7, 0.012, Math.min(0.14, ih * 0.4), sd * 0.3, metal);
                }
            }
        } else {
            const isGlassDoor = item.model === 'glass-double-door';
            for (const spec of doorLeaves(item)) {
                const pivot = new T.Group();
                const length = spec.width / 1000 - (item.model === 'double-door' || isGlassDoor ? t : 2 * t);
                pivot.name = 'door-leaf';
                pivot.position.set(spec.hinge / 1000 + spec.direction * t, 0, 0);
                // In cutaway or glass storefront, keep leaves tastefully ajar (~48 deg for glass mall door, 90 deg for regular)
                pivot.rotation.y = (item.flipped ? 1 : -1) * spec.direction * (isGlassDoor ? Math.PI * 0.32 : Math.PI / 2);
                group.add(pivot);
                const leafH = displayH - (options.cutaway ? 0 : t);
                if (isGlassDoor) {
                    const rail = 0.042;
                    const parts = [
                        box(spec.direction * length / 2, rail / 2, 0, length, rail, 0.036, frame),
                        box(spec.direction * length / 2, leafH - rail / 2, 0, length, rail, 0.036, frame),
                        box(spec.direction * rail / 2, leafH / 2, 0, rail, leafH, 0.036, frame),
                        box(spec.direction * (length - rail / 2), leafH / 2, 0, rail, leafH, 0.036, frame),
                        box(spec.direction * length / 2, leafH / 2, 0, Math.max(0.05, length - rail * 2), Math.max(0.05, leafH - rail * 2), 0.012, glass),
                        // Tall stainless vertical push/pull handle on both faces
                        box(spec.direction * (length - Math.min(0.11, length * 0.16)), Math.min(leafH * 0.5, 1.05), 0.042, 0.022, Math.min(0.55, leafH * 0.45), 0.022, metal),
                        box(spec.direction * (length - Math.min(0.11, length * 0.16)), Math.min(leafH * 0.5, 1.05), -0.042, 0.022, Math.min(0.55, leafH * 0.45), 0.022, metal),
                    ];
                    parts.forEach(p => { group.remove(p); pivot.add(p); });
                } else {
                    const leaf = box(spec.direction * length / 2, leafH / 2, 0, length, leafH, 0.04, surface);
                    group.remove(leaf); pivot.add(leaf);
                    const handle = box(spec.direction * (length - Math.min(0.1, length * 0.2)), Math.min(leafH * 0.48, 0.98), 0.036, Math.min(0.12, length * 0.3), 0.02, 0.028, metal);
                    group.remove(handle); pivot.add(handle);
                }
            }
        }
    }

    const used = new Set<T.Material>();
    group.traverse(o => { if (o instanceof T.Mesh) used.add(o.material as T.Material); });
    [surface, baseboardMat, capMat, frame, glass, metal, heatLampGlow].forEach(m => { if (!used.has(m)) m.dispose(); });
    return group;
}
