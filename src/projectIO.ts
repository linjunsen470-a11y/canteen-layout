import { ordinaryEquipment } from './equipmentFacing';
import { Project, Item, modelOf, catalog, projectIdentity } from './model';
import { isAnnotation } from './annotations';
import { syncStructure, isAttachedOpening } from './structure';
const kinds = new Set(['table', 'chair', 'counter', 'sink', 'fridge', 'stove', 'shelf', 'partition', 'wall','door','window','stairs','text','dimension','leader','zone','column','fixture','utility']);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function parseProject(value: unknown): Project {
    if (!value || typeof value !== 'object')
        throw new Error('项目格式不正确');
    const p = value as Project;
    const version=(value as {schemaVersion?:unknown}).schemaVersion;
    if (version !== undefined && version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6)
        throw new Error('不支持此项目文件版本，请使用对应版本的软件打开；当前项目未更改');
    const identity = projectIdentity();
    if (version === 1 || version === 2 || version === 3 || version === 4 || version === 5 || version === 6) {
        if (typeof p.id !== 'string' || !p.id || ![p.createdAt,p.updatedAt].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))) || !p.metadata || !['customer','site','purpose','notes'].every(k=>typeof p.metadata[k as keyof typeof p.metadata]==='string') || !['propertyId','inquiryId'].every(k=>p.metadata[k as keyof typeof p.metadata]===undefined||typeof p.metadata[k as keyof typeof p.metadata]==='string'))
            throw new Error('项目身份或资料无效');
        Object.assign(identity,{id:p.id,createdAt:p.createdAt,updatedAt:p.updatedAt,metadata:{customer:p.metadata.customer,site:p.metadata.site,purpose:p.metadata.purpose,notes:p.metadata.notes,propertyId:p.metadata.propertyId,inquiryId:p.metadata.inquiryId}});
    }
    if (typeof p.name !== 'string' || !finite(p.width) || p.width <= 0 || !finite(p.height) || p.height <= 0 || !Array.isArray(p.items))
        throw new Error('场地名称或尺寸无效');
    const ids = new Set<string>();
    const items = p.items.map((i: Item) => {
        if (!i || typeof i.id !== 'string' || !i.id || ids.has(i.id) || !kinds.has(i.kind) || typeof i.name !== 'string' || typeof i.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(i.color) || ![i.x, i.y, i.w, i.d, i.h, i.rotation].every(finite) || i.w <= 0 || i.d <= 0 || i.h < 0 || (i.locked !== undefined && typeof i.locked !== 'boolean') || (i.hidden !== undefined && typeof i.hidden !== 'boolean'))
            throw new Error('物件数据无效或 ID 重复');
        if(i.model !== undefined && !catalog.some(c=>c.model===i.model&&(c.kind===i.kind||i.kind==='zone'))) throw new Error('模型类型无效');
        if(isAttachedOpening(i)&&(typeof i.wallId!=='string'||!finite(i.offset)||!finite(i.sill)|| (i.kind==='door'&&i.sill!==0)))throw new Error('门窗关联与位置无效');
        if(i.flipped!==undefined&&typeof i.flipped!=='boolean')throw new Error('开向无效');
        if(i.zoneId!==undefined&&(typeof i.zoneId!=='string'||i.kind==='zone'||!p.items.some(z=>z&&z.id===i.zoneId&&z.kind==='zone')))throw Error('所属区域无效');
        if(i.fontSize!==undefined&&(!finite(i.fontSize)||i.fontSize<20))throw Error('文字高度至少 20mm');
        ids.add(i.id);
        return { catalogId:i.catalogId,specification:i.specification,operationFace:ordinaryEquipment(i)?(i.operationFace??'none'):i.operationFace, model: isAnnotation(i)?undefined:modelOf(i), id: i.id, kind: i.kind, name: i.name, color: i.color, x: i.x, y: i.y, w: i.w, d: i.d, h: i.h, rotation: i.rotation, locked: i.locked,hidden:i.hidden,fontSize:i.fontSize,zoneId:i.zoneId,wallId:i.wallId,offset:i.offset,sill:i.sill,flipped:i.flipped,hingeRight:i.hingeRight,freeStanding:i.freeStanding,polygon:i.polygon,pointType:i.pointType,verification:i.verification,notes:i.notes,seats:i.seats,supportId:i.supportId,measure:i.measure };
    });
    return syncStructure({ ...identity, name: p.name, width: p.width, height: p.height, outline:p.outline, underlay:p.underlay, planningAreas:p.planningAreas,groups:p.groups,clearance:p.clearance, items });
}
export function download(data: Blob, filename: string) {
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
