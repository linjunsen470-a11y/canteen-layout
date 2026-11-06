import { operationFace, ordinaryEquipment, facingModels } from './equipmentFacing';
import { validateLayout, syncMeasurements } from './layoutData';
import { Item, Project, uid } from './model';
import { validateZone } from './zones';
import { validateSiteExtras } from './siteExtras';
import { validateSite } from './site';
export const isOpening = (i: Pick<Item, 'kind'>) => i.kind === 'door' || i.kind === 'window';
export const isAttachedOpening=(i:Pick<Item,'kind'|'freeStanding'>)=>isOpening(i)&&!i.freeStanding;
export const isBuilding = (i: Pick<Item, 'kind'>) => i.kind === 'wall' || i.kind === 'partition' || isOpening(i);
export function wallPoint(wall: Item, offset: number) { const a = wall.rotation * Math.PI / 180; return { x: wall.x + wall.w / 2 + (offset - wall.w / 2) * Math.cos(a), y: wall.y + wall.d / 2 + (offset - wall.w / 2) * Math.sin(a) }; }
export function projectOnWall(wall: Item, point: {
    x: number;
    y: number;
}) { const a = wall.rotation * Math.PI / 180, dx = point.x - wall.x - wall.w / 2, dy = point.y - wall.y - wall.d / 2; return { offset: dx * Math.cos(a) + dy * Math.sin(a) + wall.w / 2, distance: Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) }; }
export function openingError(wall: Item, opening: Item, others: Item[]) {
    const offset = opening.offset ?? 0, sill = opening.sill ?? 0;
    if (!Number.isFinite(offset) || !Number.isFinite(sill) || sill < 0 || opening.w < 100 || opening.h < 100)
        return '门窗宽高至少为 100mm，离地高度不能为负数';
    if (offset < 50 || offset + opening.w > wall.w - 50)
        return '门窗超出墙体范围，请调整距墙起点或宽度（两端至少留 50mm）';
    if (sill + opening.h > wall.h - 50)
        return '门窗超过墙高，请降低高度或窗台，顶部至少留 50mm';
    if (opening.kind === 'door' && sill !== 0)
        return '门必须从地面开始';
    if (others.some(o => isOpening(o) && o.wallId === wall.id && o.id !== opening.id && Math.min(offset + opening.w, (o.offset ?? 0) + o.w) > Math.max(offset, o.offset ?? 0) + .01 && Math.min(sill + opening.h, (o.sill ?? 0) + o.h) > Math.max(sill, o.sill ?? 0) + .01))
        return '门窗开口重叠，请沿墙移动到空余位置';
    return null;
}
// Attached opening transforms are derived here, shared by every edit and import path.
export function syncStructure(project: Project): Project {
    validateSite(project);validateSiteExtras(project);validateLayout(project);
    const items = project.items.map(i => {
        validateZone(i);
        if(i.catalogId!==undefined&&(typeof i.catalogId!=='string'||!i.catalogId.trim()||i.catalogId.length>200))throw Error('目录来源标识无效');
        if(i.specification!==undefined&&(typeof i.specification!=='string'||i.specification.length>500))throw Error('规格说明无效');
        if(i.operationFace!==undefined&&(!ordinaryEquipment(i)||!['none','positive-y'].includes(i.operationFace)||(i.operationFace==='positive-y'&&(!i.model||!facingModels.has(i.model)))))throw Error('设备操作面定义无效');
        if(ordinaryEquipment(i))i={...i,operationFace:operationFace(i)};
        if(i.hingeRight!==undefined&&(i.kind!=='door'||typeof i.hingeRight!=='boolean'))throw Error('门轴设置仅适用于门，且必须为布尔值');
        if(i.flipped!==undefined&&typeof i.flipped!=='boolean')throw Error('开向无效');
        if(i.freeStanding!==undefined&&(typeof i.freeStanding!=='boolean'||!isOpening(i)))throw Error('独立放置状态仅适用于门窗');
        if(i.notes!==undefined&&typeof i.notes!=='string')throw Error('现场备注无效');
        if(i.verification!==undefined&&!['pending','confirmed'].includes(i.verification))throw Error('现场确认状态无效');
        if(i.pointType!==undefined&&(i.kind!=='utility'||!['entrance','exhaust','water','drain','power'].includes(i.pointType)))throw Error('工程点位类型无效');
        if (!isOpening(i)) {
            if (i.wallId !== undefined || i.offset !== undefined || i.sill !== undefined)
                throw Error('只有门窗可以设置墙体关联与离地高度');
            if (i.kind === 'wall' && (i.w < 100 || i.d < 50 || i.h < 100))
                throw Error('墙体/隔断长度、高度至少 100mm，厚度至少 50mm');
            return i;
        }
        if(i.freeStanding){
            if(i.wallId!==undefined||i.offset!==undefined||!Number.isFinite(i.sill??0)||(i.sill??0)<0||(i.kind==='door'&&(i.sill??0)!==0)||i.w<100||i.h<100)throw Error('独立门窗位置或尺寸无效');
            return {...i,sill:i.kind==='door'?0:i.sill??900};
        }
        const wall = project.items.find(w => w.id === i.wallId && w.kind === 'wall');
        if (!wall)
            throw Error('门窗必须关联有效墙体');
        const opening = { ...i, offset: i.offset ?? 50, sill: i.kind === 'door' ? 0 : i.sill ?? 900 };
        const error = openingError(wall, opening, project.items);
        if (error)
            throw Error(error);
        const center = wallPoint(wall, opening.offset + opening.w / 2);
        return { ...opening, x: center.x - opening.w / 2, y: center.y - wall.d / 2, d: wall.d, rotation: wall.rotation };
    });
    return syncMeasurements({ ...project, items });
}
export function openingSlot(wall: Item, opening: Item, items: Item[], preferred: number) {
    const candidates = [preferred, 50, wall.w-opening.w-50, ...items.filter(i => i.wallId === wall.id && i.id!==opening.id).flatMap(i => [(i.offset ?? 0) + i.w, (i.offset ?? 0)-opening.w])];
    return candidates.map(n => Math.max(50, Math.min(wall.w - opening.w - 50, n))).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)).find(offset => !openingError(wall, { ...opening, wallId: wall.id, offset }, items));
}
export function attachOpening(project: Project, opening: Item, point: {
    x: number;
    y: number;
}, preferredWall?: string, exact = false, step=100): Item {
    const walls = project.items.filter(i => i.kind === 'wall' && !i.locked && !i.hidden).map(w => ({ w, ...projectOnWall(w, point) })).sort((a, b) => Math.hypot(a.distance,Math.max(0,-a.offset,a.offset-a.w.w))-Math.hypot(b.distance,Math.max(0,-b.offset,b.offset-b.w.w)));
    const chosen = exact ? walls.find(v => v.distance <= Math.max(v.w.d / 2 + 200, 350) && v.offset >= -100 && v.offset <= v.w.w + 100) : walls.find(v => v.w.id === preferredWall) ?? walls[0];
    if (!chosen)
        throw Error(exact ? '请将门窗拖到未锁定的墙体上' : '请先绘制墙体，再选中墙体添加门窗');
    const sill = opening.kind === 'door' ? 0 : opening.sill??900;
    const candidate = { ...opening, freeStanding:false, wallId: chosen.w.id, sill, offset: 50 };
    const preferred = exact ? step>0?Math.round((chosen.offset - opening.w / 2) / step) * step:chosen.offset-opening.w/2 : (chosen.w.w - opening.w) / 2;
    const offset = exact ? Math.max(50, Math.min(chosen.w.w-opening.w-50,preferred)) : openingSlot(chosen.w, candidate, project.items, preferred);
    if (offset === undefined)
        throw Error('该墙体没有足够的门窗空间，请加长/加高墙体或调整已有开口');
    const error=openingError(chosen.w,{...candidate,offset},project.items);
    if(error)throw Error(error);
    return { ...candidate, offset };
}
export type WallSection = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export function wallSections(wall: Pick<Item, 'w' | 'h'>, openings: Item[]): WallSection[] {
    const stops = [...new Set([0, wall.w, ...openings.flatMap(o => [o.offset!, o.offset! + o.w])])].sort((a, b) => a - b);
    const sections: WallSection[] = [];
    for (let n = 0; n < stops.length - 1; n++) {
        const left = stops[n], right = stops[n + 1];
        if (right - left < .01)
            continue;
        const holes = openings.filter(o => o.offset! < right && o.offset! + o.w > left).map(o => ({ bottom: o.sill ?? 0, top: (o.sill ?? 0) + o.h })).sort((a, b) => a.bottom - b.bottom);
        let bottom = 0;
        for (const hole of holes) {
            if (hole.bottom > bottom)
                sections.push({ x: left, y: bottom, w: right - left, h: hole.bottom - bottom });
            bottom = Math.max(bottom, hole.top);
        }
        if (bottom < wall.h)
            sections.push({ x: left, y: bottom, w: right - left, h: wall.h - bottom });
    }
    return sections;
}
export function duplicateItems(project: Project, ids: string[], dx=300, dy=300) {
    const chosen = new Set(ids);
    project.items.forEach(i => { if (i.wallId && chosen.has(i.wallId))
        chosen.add(i.id); });
    const mapping = new Map([...chosen].map(id => [id, uid()]));
    const copies: Item[] = [];
    for (const i of project.items.filter(i => chosen.has(i.id))) {
        let copy = { ...i, id: mapping.get(i.id)!, locked: false, x: i.x + dx, y: i.y + dy, name: i.name + ' 副本' };
        if (isAttachedOpening(i)) {
            if (mapping.has(i.wallId!))
                copy.wallId = mapping.get(i.wallId!);
            else {
                const wall = project.items.find(w => w.id === i.wallId)!;
                if (wall.locked)
                    throw Error('所属墙体已锁定');
                const offset = openingSlot(wall, copy, [...project.items, ...copies], (i.offset ?? 0) + i.w + 100);
                if (offset === undefined)
                    throw Error('墙上没有足够空间复制门窗');
                copy.offset = offset;
            }
        }
        if(i.zoneId&&mapping.has(i.zoneId))copy.zoneId=mapping.get(i.zoneId);
        if(i.supportId&&mapping.has(i.supportId))copy.supportId=mapping.get(i.supportId);
        if(i.measure)copy.measure={...i.measure,a:mapping.get(i.measure.a)??i.measure.a,b:mapping.get(i.measure.b)??i.measure.b};
        copies.push(copy);
    }
    return { project: syncStructure({ ...project, items: [...project.items, ...copies],groups:[...(project.groups??[]),...(project.groups??[]).filter(g=>g.members.every(id=>mapping.has(id))).map(g=>({...g,id:uid(),members:g.members.map(id=>mapping.get(id)!)}))] }), ids: copies.map(i => i.id) };
}
export function segmentPose(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}, thickness: number) { const w = Math.hypot(b.x - a.x, b.y - a.y); return { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - thickness / 2, w, rotation: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI }; }

// During a drag, openings follow the nearest wall under the pointer; no jump to a distant free slot.
export function dragOpening(project:Project,opening:Item,point:{x:number;y:number},snap:boolean,tolerance=400,step=100):Partial<Item>{
 const candidates=project.items.filter(i=>i.kind==='wall'&&!i.locked&&!i.hidden).map(w=>({wall:w,...projectOnWall(w,point)})).filter(c=>c.offset>=-100&&c.offset<=c.wall.w+100&&c.distance<=Math.max(tolerance,c.wall.d/2+150)).sort((a,b)=>a.distance-b.distance);
 const current=project.items.find(w=>w.id===opening.wallId)!;
 const wall=candidates[0]?.wall??current;
 let offset=projectOnWall(wall,point).offset-opening.w/2;
 if(snap)offset=Math.round(offset/step)*step;
 offset=Math.max(50,Math.min(wall.w-opening.w-50,offset));
 return {wallId:wall.id,offset};
}
