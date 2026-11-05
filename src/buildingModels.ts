import * as T from 'three';
import { Item, Point } from './model';
import { wallSections } from './structure';
type Spec = Pick<Item, 'kind' | 'w' | 'd' | 'h' | 'color' | 'flipped' | 'model'>;
export function createBuildingModel(item: Spec, openings: Item[] = [],profile?:Point[]) {
    const group = new T.Group(), w = item.w / 1000, d = item.d / 1000, h = item.h / 1000;
    const surface = new T.MeshStandardMaterial({ color: item.color, roughness: .88 });
    const frame = new T.MeshStandardMaterial({ color: item.kind === 'door' ? '#e1ddd2' : item.color, roughness: .32, metalness: item.kind === 'door' ? .1 : .65 });
    const glass = new T.MeshPhysicalMaterial({ color: '#b9dce2', roughness: .12, transparent: true, opacity: .3, metalness: .05, depthWrite: false, side: T.DoubleSide });
    const metal = new T.MeshStandardMaterial({ color: '#bac3c4', metalness: .8, roughness: .25 });
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number, mat: T.Material = surface) => { const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), mat); mesh.position.set(x, y, z); mesh.castShadow = mat !== glass; mesh.receiveShadow = true; group.add(mesh); return mesh; };
    if (item.kind === 'wall') {
        wallSections(item, openings).forEach(s => {
            if(!profile){box((s.x+s.w/2)/1000-w/2,(s.y+s.h/2)/1000,0,s.w/1000,s.h/1000,d);return}
            const left=s.x-item.w/2,right=s.x+s.w-item.w/2,points=[s.x===0?profile[0]:{x:left,y:-item.d/2},s.x===0?profile[1]:{x:left,y:item.d/2},Math.abs(s.x+s.w-item.w)<.01?profile[2]:{x:right,y:item.d/2},Math.abs(s.x+s.w-item.w)<.01?profile[3]:{x:right,y:-item.d/2}];
            const shape=new T.Shape(points.map(p=>new T.Vector2(p.x/1000,-p.y/1000))),mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:s.h/1000,bevelEnabled:false}),surface);mesh.rotation.x=-Math.PI/2;mesh.position.y=s.y/1000;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
        });
    }
    else {
        const t = Math.min(.045, w * .08, h * .08), depth = Math.max(.05, d);
        box(-w / 2 + t / 2, h / 2, 0, t, h, depth, frame);
        box(w / 2 - t / 2, h / 2, 0, t, h, depth, frame);
        box(0, h - t / 2, 0, w - 2 * t, t, depth, frame);
        if (item.kind === 'window') {
            box(0, t / 2, 0, w - 2 * t, t, depth, frame);
            const iw=w-2*t,ih=h-2*t;
            if(item.model==='fixed-window')box(0,h/2,0,iw,ih,.008,glass);
            else {
                const sw=(iw+t)/2,rail=Math.min(t*.65,.028),sd=Math.min(.035,depth*.22);
                for(const sign of [-1,1]){
                    const cx=sign*(iw-sw)/2,z=sign*depth*.18;
                    box(cx-sw/2+rail/2,h/2,z,rail,ih,sd,frame);box(cx+sw/2-rail/2,h/2,z,rail,ih,sd,frame);
                    box(cx,t+rail/2,z,sw-2*rail,rail,sd,frame);box(cx,h-t-rail/2,z,sw-2*rail,rail,sd,frame);
                    box(cx,h/2,z,sw-2*rail,ih-2*rail,.008,glass);
                    box(cx-sign*(sw/2-rail*1.5),h/2,z+sd*.7,.012,Math.min(.14,ih*.4),sd*.3,metal);
                }
            }
        }
        else {
            const pivot = new T.Group();
            pivot.position.set(-w / 2 + t, 0, 0);
            pivot.rotation.y = (item.flipped ? 1 : -1) * Math.PI / 2;
            group.add(pivot);
            const leaf = box((w - 2 * t) / 2, (h - t) / 2, 0, w - 2 * t, h - t, .035, surface);
            group.remove(leaf);
            pivot.add(leaf);
            const handle = box(w - 2 * t - .10, h * .46, .034, .12, .018, .025, metal);
            group.remove(handle);
            pivot.add(handle);
        }
    }
    const used = new Set<T.Material>();
    group.traverse(o => { if (o instanceof T.Mesh)
        used.add(o.material as T.Material); });
    [surface, frame, glass, metal].forEach(m => { if (!used.has(m))
        m.dispose(); });
    return group;
}
