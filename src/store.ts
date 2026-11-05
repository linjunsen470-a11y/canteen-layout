import { movableSelection } from './layoutGroups';
import { pruneLayout } from './layoutData';
import { normalizeRotation } from './rotation';
import { create } from 'zustand';
import { usePlanning, planningEditable } from './planning';
import { polygonPatch } from './zones';
import { Item, Project, Point, Underlay, blankProject, uid } from './model';
import { syncStructure, isOpening, isAttachedOpening, projectOnWall, duplicateItems } from './structure';
import { EditorMode, EditorTool, isEditable } from './editorInteraction';
type State = {
    placement:{origins:Item[];anchor:Point}|null;
    calibrationPoints:Point[];
    setCalibrationPoints:(points:Point[])=>void;
    moveZone:(id:string,points:Point[])=>void;
    moveUnderlay:(patch:Partial<Underlay>)=>void;
    project: Project;
    error: string | null;
    duplicate: (ids: string[]) => string[];
    cancelMove: () => void;
    selected: string | null;
    selectedIds: string[];
    mode: EditorMode;
    tool: EditorTool;
    interactionEpoch: number;
    focusRequest: number;
    selectMany: (ids:string[])=>void;
    setTool: (tool:EditorTool)=>void;
    setMode: (mode:EditorMode)=>void;
    cancelInteraction: ()=>void;
    locate: (id?:string)=>void;
    setFlags: (ids:string[],patch:Pick<Partial<Item>,'locked'|'hidden'>)=>void;
    past: Project[];
    future: Project[];
    gesture: Project | null;
    setProject: (project: Project) => void;
    commit: (project: Project) => boolean;
    select: (id: string | null) => void;
    addItem: (item: Omit<Item, 'id'>) => string | null;
    update: (id: string, patch: Partial<Item>) => void;
    updateMany: (changes: {
        id: string;
        patch: Partial<Item>;
    }[]) => void;
    move: (id: string, patch: Partial<Item>) => void;
    moveMany: (changes:{id:string;patch:Partial<Item>}[]) => void;
    moveOutline: (outline: NonNullable<Project['outline']>, planningId?:string) => void;
    beginMove: () => void;
    endMove: () => void;
    removeMany: (ids: string[]) => void;
    undo: () => void;
    redo: () => void;
    resize: (width: number, height: number) => void;
};
const validSize = (n: number) => Number.isFinite(n) && n > 0;
function patchItem(item: Item, patch: Partial<Item>): Item {
    if (item.locked)
        return patch.locked === false ? { ...item, locked: false } : item;
    for (const key of ['w', 'd', 'h', 'x', 'y', 'rotation', 'offset', 'sill'] as const) {
        const value = patch[key];
        if (value !== undefined && (!Number.isFinite(value) || (['w', 'd'].includes(key) && value <= 0) || (key === 'h' && value < 0)))
            return item;
    }
    if(patch.rotation!==undefined)patch={...patch,rotation:normalizeRotation(patch.rotation)};
    return { ...item, ...patch, id: item.id, kind: item.kind };
}
function applyChanges(project: Project, changes: {
    id: string;
    patch: Partial<Item>;
}[]): Project {
    const next = { ...project, items: project.items.map(item => {
            const change = changes.find(c => c.id === item.id);
            if (!change)
                return item;
            if(!isEditable(item,project))throw Error('对象已锁定、隐藏或位于当前规划范围外');
            const wall = project.items.find(w => w.id === item.wallId);
            if (isOpening(item) && wall?.locked)
                throw Error('所属墙体已锁定，请先解锁墙体');
            let patch = { ...change.patch };
            if(isAttachedOpening(item)&&patch.rotation!==undefined&&Math.abs(normalizeRotation(patch.rotation)-normalizeRotation(item.rotation))>1e-8)patch={...patch,freeStanding:true,wallId:undefined,offset:undefined};

            if(patch.wallId&&project.items.find(w=>w.id===patch.wallId)?.locked)throw Error('目标墙体已锁定');
            if (isAttachedOpening(item) && !patch.freeStanding && wall && (patch.x !== undefined || patch.y !== undefined)) {
                patch.offset = projectOnWall(wall, { x: (patch.x ?? item.x) + item.w / 2, y: (patch.y ?? item.y) + item.d / 2 }).offset - item.w / 2;
            }
            const next=patchItem(item,patch);if(!planningEditable(next,project))throw Error('对象需完整位于当前规划范围内；可切回整场地继续编辑');return next;
        }) };
    const synced=syncStructure(next),changed=new Set(changes.map(c=>c.id));
    if(synced.items.some(i=>(changed.has(i.id)||!!i.wallId&&changed.has(i.wallId))&&(!planningEditable(i,synced)||(i.wallId&&!planningEditable(synced.items.find(w=>w.id===i.wallId)!,synced)))))throw Error('修改后的对象或关联门窗超出当前规划范围');
    return synced;
}
export const useStore = create<State>((set, get) => ({
    placement:null,
    moveZone:(id,points)=>{try{get().move(id,polygonPatch(points))}catch(e){set({error:(e as Error).message})}},
    calibrationPoints:[],setCalibrationPoints:calibrationPoints=>set({calibrationPoints}),moveUnderlay:patch=>{const p=get().project;if(p.underlay)set({project:{...p,underlay:{...p.underlay,...patch}}})},
    project: blankProject(), selected: null, selectedIds:[], mode:'layout', tool:'select',interactionEpoch:0,focusRequest:0,past: [], future: [], gesture: null, error: null,
    selectMany: ids=>{const valid=[...new Set(ids)].filter(id=>get().project.items.some(i=>i.id===id));const items=get().project.items.filter(i=>valid.includes(i.id));set({selectedIds:valid,selected:valid.at(-1)??null,...(items.length?{mode:items.every(i=>['wall','door','window','partition'].includes(i.kind))?'structure' as const:'layout' as const}:{}),error:null})},
    cancelInteraction: ()=>{get().cancelMove();set(s=>({tool:'select',placement:null,selectedIds:s.selectedIds.filter(id=>s.project.items.some(i=>i.id===id)),selected:s.project.items.some(i=>i.id===s.selected)?s.selected:null,calibrationPoints:[],interactionEpoch:s.interactionEpoch+1}))},
    setTool: tool=>{get().cancelInteraction();set({tool,...((tool.startsWith('outline')||tool.startsWith('underlay')||tool.startsWith('planning'))?{mode:'site' as const,selected:null,selectedIds:[]}:tool==='wall'||tool==='partition'?{mode:'structure' as const}:['zone','zone-draw','zone-edit','text','dimension','leader'].includes(tool)?{mode:'layout' as const}:{})})},
    setMode: mode=>{get().cancelInteraction();set({mode,selected:null,selectedIds:[]})},
    locate: id=>{get().cancelInteraction();if(id)get().selectMany([id]);set(s=>({focusRequest:s.focusRequest+1}))},
    setFlags: (ids,patch)=>{get().cancelInteraction();get().commit({...get().project,items:get().project.items.map(i=>ids.includes(i.id)?{...i,...patch}:i)})},
    setProject: project => { try {
        usePlanning.getState().set({activeId:null});
        set(s=>({ project: syncStructure(project),placement:null,calibrationPoints:[], selected: null,selectedIds:[],tool:'select',mode:'layout',interactionEpoch:s.interactionEpoch+1, past: [], future: [], gesture: null, error: null }));
    }
    catch (e) {
        set({ error: (e as Error).message });
    } },
    commit: project => {
        const s = get();
        try {
            project = syncStructure(project);
        }
        catch (e) {
            set({ error: (e as Error).message });
            return false;
        }
        if (JSON.stringify(project) === JSON.stringify(s.project)) {
            set({ error: null });
            return true;
        }
        set({ project, past: [...s.past, s.project].slice(-60), future: [], error: null });
        return true;
    },
    select: selected => get().selectMany(selected?[selected]:[]),
    addItem: item => {
        const id=uid();try{
            const project=syncStructure({...get().project,items:[...get().project.items,{...item,id}]}),added=project.items.find(i=>i.id===id)!;
            if(!planningEditable(added,project)||(added.wallId&&!planningEditable(project.items.find(i=>i.id===added.wallId)!,project)))throw Error('请放在当前规划范围内，或切回整场地');
            if(!get().commit(project))return null;get().selectMany([id]);return id;
        }catch(e){set({error:(e as Error).message});return null}
    },
    update: (id, patch) => get().updateMany([{ id, patch }]),
    updateMany: changes => { try {
        get().commit(applyChanges(get().project, changes));
    }
    catch (e) {
        set({ error: (e as Error).message });
    } },
    move: (id,patch)=>get().moveMany([{id,patch}]),
    moveOutline: (outline,planningId)=>{try{const p=get().project;set({project:syncStructure(planningId?{...p,planningAreas:p.planningAreas?.map(a=>a.id===planningId?{...a,outline}:a)}:{...p,outline}),error:null})}catch(e){set({error:(e as Error).message})}},
    moveMany:changes=>{try{set({project:applyChanges(get().project,changes),error:null})}catch(e){set({error:(e as Error).message})}},
    beginMove: () => set({ gesture: get().project }),
    cancelMove: () => { const project = get().gesture; if (project)
        set({ project, gesture: null, error: null }); },
    endMove: () => {
        const s = get();
        if (s.gesture && JSON.stringify(s.gesture) !== JSON.stringify(s.project))
            set({ past: [...s.past, s.gesture].slice(-60), future: [] });
        set({ gesture: null });
    },
    duplicate: ids => { try {
        const eligible=movableSelection(get().project,ids).map(i=>i.id);if(!eligible.length)throw Error('选中对象已锁定、隐藏或位于当前规划范围外');const result = duplicateItems(get().project, eligible);if(result.project.items.some(i=>result.ids.includes(i.id)&&!planningEditable(i,result.project)))throw Error('副本超出当前规划范围，请切回整场地复制');
        if (get().commit(result.project)) {
            get().selectMany(result.ids);
            return result.ids;
        }
    }
    catch (e) {
        set({ error: (e as Error).message });
    } return []; },
    removeMany: ids => {
        const project = get().project;
        const removed = new Set(project.items.filter(i => ids.includes(i.id) && isEditable(i,project)).map(i => i.id));
        if(!removed.size){set({error:'选中对象已锁定、隐藏或位于当前规划范围外'});return}
        for (const i of project.items) {
            if (i.wallId && removed.has(i.wallId)) {
                if (i.locked) {
                    set({ error: '墙体包含锁定的门窗，请先解锁再删除墙体' });
                    return;
                }
                removed.add(i.id);
            }
            if (isOpening(i) && removed.has(i.id) && project.items.find(w => w.id === i.wallId)?.locked) {
                set({ error: '所属墙体已锁定' });
                return;
            }
        }
        get().commit(pruneLayout({ ...project, items: project.items.filter(i => !removed.has(i.id)).map(i=>i.zoneId&&removed.has(i.zoneId)?{...i,zoneId:undefined}:i) }));
        get().selectMany([]);
    },
    undo: () => { get().cancelInteraction(); set(s => s.past.length ? { project: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.project, ...s.future], selected: null,selectedIds:[], error: null } : {}); },
    redo: () => { get().cancelInteraction(); set(s => s.future.length ? { project: s.future[0], past: [...s.past, s.project], future: s.future.slice(1), selected: null,selectedIds:[], error: null } : {}); },
    resize: (width, height) => { if (validSize(width) && validSize(height))
        {const p=get().project;get().commit({ ...p, width, height, outline:p.outline?.map(v=>({x:v.x*width/p.width,y:v.y*height/p.height})) });} },
}));
