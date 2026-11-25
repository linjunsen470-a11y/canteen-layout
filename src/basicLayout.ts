import { businessTypeDefaults, decorThemePresets, defaultConceptOptions, generateConceptLayout, nearestTableGap, type ConceptBusinessType } from './conceptPlanner';
import { seatSummary } from './layoutGroups';
import { entryRoutes } from './entryAccess';
import { defaultProjectStyle, resolveStyle, type Item, type Point, type Project } from './model';
import { parseProject } from './projectIO';
import { planningArea, siteOutline } from './site';
import { footprint, inPolygon } from './spatial';
import { checkSpace } from './spaceChecks';

function quarterTurn(project: Project): Project {
  const point = (p: Point) => ({ x: project.height - p.y, y: p.x });
  return {
    ...project, width: project.height, height: project.width, outline: siteOutline(project).map(point),
    survey: project.survey && { ...project.survey, corners: project.survey.corners.map(point) },
    planningAreas: project.planningAreas?.map(a => ({ ...a, outline: a.outline.map(point) })),
    items: project.items.map(i => {
      const center = point({ x: i.x+i.w/2, y: i.y+i.d/2 });
      return { ...i, x: center.x-i.w/2, y: center.y-i.d/2, rotation: (i.rotation+90)%360 };
    }),
  };
}

// Negative sorts the stronger layout first. Equal scores keep the original trial order.
function rank(a: number[], b: number[]) {
  const i = a.findIndex((v,i) => v !== b[i]);
  return i < 0 ? 0 : b[i] - a[i];
}

function isDefaultShellStyle(shell: Project): boolean {
  if (shell.basicDraft) return false;
  const s = shell.style;
  if (!s) return true;
  const isRawSurvey = s.floorMaterial === 'concrete' && s.wallMaterial === 'plaster' && s.lightingPreset === 'daylight';
  const isBlankDefault =
    (!s.floorMaterial || s.floorMaterial === defaultProjectStyle.floorMaterial) &&
    (!s.wallMaterial || s.wallMaterial === defaultProjectStyle.wallMaterial) &&
    (!s.lightingPreset || s.lightingPreset === defaultProjectStyle.lightingPreset);
  return isRawSurvey || isBlankDefault;
}

function defaultDraftStyle(shell: Project, business: ConceptBusinessType): Project['style'] {
  if (!isDefaultShellStyle(shell)) return shell.style;
  const defaults = businessTypeDefaults[business];
  const themeId = defaults.themeId ?? defaults.defaultTheme;
  const theme = decorThemePresets.find(preset => preset.id === themeId);
  if (!theme) return shell.style;
  return {
    ...resolveStyle(shell),
    floorMaterial: theme.floorMaterial,
    wallMaterial: theme.wallMaterial,
    lightingPreset: theme.lightingPreset,
  };
}

export type BasicLayoutCandidate = {
  project: Project;
  warnings: string[];
  label: string;
  tables: number;
  tableGapMm: number | null;
  capacity: ReturnType<typeof seatSummary>;
};

export function generateBasicLayoutCandidates(shell: Project, business: ConceptBusinessType, maxCount = 3): BasicLayoutCandidate[] {
  const original = new Map(shell.items.map(i => [i.id,i]));
  const options = { ...defaultConceptOptions(business), includeLights: false, themeId: 'keep' as const };
  const layouts = (['rear','left'] as const).flatMap(kitchenSide => {
    // A kiosk can need nearly its whole floor for service and washing.
    const ratios = planningArea(shell) < 20e6 ? [options.kitchenRatioPct, 60, 100] : [options.kitchenRatioPct];
    return ratios.map(kitchenRatioPct => ({ ...options, kitchenSide, kitchenRatioPct }));
  });
  let frame = shell;
  const sides = ['上方', '左侧', '下方', '右侧'];
  type Trial = { project: Project; warnings: string[]; score: number[]; turn: number; order: number; seats: number; tableGapMm: number | null };
  const bySide = new Map<string, Trial>();
  let order = 0;
  for (let turn = 0; turn < 4; turn++, frame = quarterTurn(frame)) {
    for (const layout of layouts) {
      const { project, estimate, kitchenZoneIds } = generateConceptLayout(frame, layout, true);
      const omitted = new Set<string>();
      const groups = project.groups ?? [];
      const byId = new Map(project.items.map(i => [i.id,i]));
      const omit = (i: Item) => {
        if (original.has(i.id)) return;
        omitted.add(i.id);
        const group = groups.find(g => g.members.includes(i.id));
        group?.members.forEach(id => omitted.add(id));
      };
      // Reject individual placements so one obstruction cannot discard a usable shell.
      if (estimate.criticalConflicts) {
        for (const issue of checkSpace(project, null)) {
          if (issue.type !== '参考净距') issue.ids.forEach(id => omit(byId.get(id)!));
        }
      }
      const conflictFree = omitted.size
        ? { ...project, items: project.items.filter(i => !omitted.has(i.id)) }
        : project;
      const kitchen = kitchenZoneIds.filter(id => !omitted.has(id)).map(id => byId.get(id)!);
      const entries = conflictFree.items.filter(i => !i.hidden && i.pointType === 'entrance');
      const entryInDining = entries.every(i => !kitchen.some(z => inPolygon({x:i.x+i.w/2,y:i.y+i.d/2}, footprint(z))));
      const routes = entryRoutes(conflictFree, kitchen);
      if (routes) {
        for (const i of conflictFree.items) {
          if (i.kind === 'chair' && !routes.customer(i)) omit(i);
          if (['chair','counter','stove','fridge','sink'].includes(i.kind) && !routes.staff(i)) omit(i);
        }
      }
      // An overhead hood belongs to the cooking station below it.
      if (project.items.some(i => i.kind === 'stove' && i.model !== 'hood' && omitted.has(i.id))) {
        project.items.filter(i => i.model === 'hood' && !original.has(i.id)).forEach(omit);
      }
      let accepted: Project = { ...project, items: project.items.filter(i => !omitted.has(i.id)),
        groups: groups.filter(g => !g.members.some(id => omitted.has(id))) };
      const has = (kind: Item['kind'], model?: Item['model']) => accepted.items.some(i => !i.hidden && i.kind === kind && (!model || i.model === model));
      const cook = business === 'cafe' ? has('counter','tea-bar') : accepted.items.some(i => i.kind === 'stove' && i.model !== 'hood' && !i.hidden);
      const functions = [cook, has('sink'), has('counter','cashier'), has('fridge')];
      const seats = accepted.items.filter(i => i.kind === 'chair' && !i.hidden).reduce((s,i) => s+(i.seats ?? 1),0);
      const nearest = omitted.size ? nearestTableGap(accepted) : estimate.nearestTables;
      const diningService = cook && has('sink') && seats > 0 && entryInDining;
      const score = [Number(diningService), functions.filter(Boolean).length, Number(cook), Number(has('sink')), Number(has('counter','cashier')), Number(entryInDining),
        Number(!nearest || nearest.distance >= options.aisleMm-.1), seats, -omitted.size];
      const side = sides[(turn + (layout.kitchenSide === 'left' ? 1 : 0)) % 4];
      const previous = bySide.get(side);
      order++;
      if (previous && rank(score, previous.score) >= 0) continue;
      const warnings = [...estimate.warnings];
      if (nearest && nearest.distance < options.aisleMm - .01) warnings.push('桌椅间距小于所选净距，请复核保留的桌椅位置');
      if (estimate.tableGroups === 24 && accepted.groups?.length === 24) {
        warnings.push('基础草稿先摆 24 组桌椅，剩余面积可按需复制桌组');
      }
      if (omitted.size) {
        const names = [...new Set(project.items.filter(i => omitted.has(i.id)).map(i => i.name))];
        warnings.push('因碰撞或入口通路不足已省略' + names.join('、'));
      }
      if (!seats && !warnings.some(w => w.includes('未摆入桌椅'))) warnings.push('当前场地未摆入桌椅组');
      if (!functions.some(Boolean) && !seats) {
        accepted = { ...accepted, items: accepted.items.filter(i => original.has(i.id)), groups: accepted.groups?.filter(g => g.members.every(id => original.has(id))) };
        warnings.push('场地仅保留铺位轮廓及固定构件，可手动放置设备');
      }
      bySide.set(side, { project: accepted, warnings, score, turn, order, seats,
        tableGapMm: nearest ? Math.floor(nearest.distance + 1e-6) : null });
    }
  }

  const ranked = [...bySide].sort(([,a],[,b]) => rank(a.score,b.score) || a.order - b.order);
  const leader = ranked[0][1];
  const draftStyle = defaultDraftStyle(shell, business);
  const choices: BasicLayoutCandidate[] = [];
  const seen = new Set<string>();
  const limit = Math.min(3, Math.max(1, Math.floor(maxCount) || 1));
  for (const [side, trial] of ranked) {
    // Only offer alternatives with the same dine-in viability as the first draft.
    if (choices.length && (!trial.seats || !leader.seats || trial.score[0] !== leader.score[0])) continue;
    let accepted = trial.project;
    for (let n = 0; n < (4 - trial.turn) % 4; n++) accepted = quarterTurn(accepted);
    const project = parseProject({ ...shell, style: draftStyle, items: accepted.items.map(i => {
      const fixed = original.get(i.id);
      return fixed ? { ...fixed, zoneId: i.zoneId } : i;
    }), groups: accepted.groups, clearance: options.aisleMm, basicDraft: { business, warnings: trial.warnings } });
    // IDs change between trials. Compare the actual positions in the user's plan instead.
    const arrangement = project.items.filter(i => !i.hidden && ['table','stove','sink','counter'].includes(i.kind))
      .map(i => [i.model ?? i.kind, Math.round((i.x+i.w/2)/100), Math.round((i.y+i.d/2)/100), i.w, i.d].join(',')).sort();
    const signature = JSON.stringify([trial.seats, arrangement]);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const tables = project.items.filter(i => i.kind === 'table' && !i.hidden).length;
    const label = trial.seats ? '后厨在图' + side : '基础草稿';
    choices.push({ project, warnings: trial.warnings, label, tables, tableGapMm: trial.tableGapMm, capacity: seatSummary(project) });
    if (choices.length >= limit) break;
  }
  return choices;
}

export function generateBasicLayout(shell: Project, business: ConceptBusinessType) {
  const [{ project, warnings }] = generateBasicLayoutCandidates(shell, business, 1);
  return { project, warnings };
}
