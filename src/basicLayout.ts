import { defaultConceptOptions, generateConceptLayout, type ConceptBusinessType } from './conceptPlanner';
import { reachableFromEntry } from './entryAccess';
import type { Item, Point, Project } from './model';
import { parseProject } from './projectIO';
import { planningArea, siteOutline } from './site';
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

function prefer(a: number[], b: number[]) {
  const i = a.findIndex((v,i) => v !== b[i]);
  return i >= 0 && a[i] > b[i];
}

export function generateBasicLayout(shell: Project, business: ConceptBusinessType) {
  const original = new Map(shell.items.map(i => [i.id,i]));
  const options = { ...defaultConceptOptions(business), includeLights: false, themeId: 'keep' as const };
  const layouts = (['rear','left'] as const).flatMap(kitchenSide => {
    // A kiosk can need nearly its whole floor for service and washing.
    const ratios = planningArea(shell) < 20e6 ? [options.kitchenRatioPct, 60, 100] : [options.kitchenRatioPct];
    return ratios.map(kitchenRatioPct => ({ ...options, kitchenSide, kitchenRatioPct }));
  });
  let frame = shell;
  let best: { project: Project; warnings: string[]; score: number[] } | undefined;
  for (let turn = 0; turn < 4; turn++, frame = quarterTurn(frame)) {
    for (const layout of layouts) {
      const { project, estimate } = generateConceptLayout(frame, layout, true);
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
      const accessible = reachableFromEntry(project);
      if (accessible) {
        for (const i of project.items) {
          if (['chair','counter','stove','fridge','sink'].includes(i.kind) && !accessible(i)) omit(i);
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
      const score = [functions.filter(Boolean).length, Number(cook), Number(has('sink')), Number(has('counter','cashier')),
        Number(!estimate.nearestTables || estimate.nearestTables.distance >= options.aisleMm-.1), seats, -omitted.size];
      if (best && !prefer(score,best.score)) continue;
      const warnings = [...estimate.warnings];
      if (omitted.size) {
        const names = [...new Set(project.items.filter(i => omitted.has(i.id)).map(i => i.name))];
        warnings.push('因碰撞或入口通路不足已省略' + names.join('、'));
      }
      if (!seats && !warnings.some(w => w.includes('未摆入桌椅'))) warnings.push('当前场地未摆入桌椅组');
      if (!functions.some(Boolean) && !seats) {
        accepted = { ...accepted, items: accepted.items.filter(i => original.has(i.id)), groups: accepted.groups?.filter(g => g.members.every(id => original.has(id))) };
        warnings.push('场地仅保留铺位轮廓及固定构件，可手动放置设备');
      }
      const reverseTurns = (4 - turn) % 4;
      for (let n = 0; n < reverseTurns; n++) accepted = quarterTurn(accepted);
      best = { project: parseProject({ ...shell, items: accepted.items.map(i => {
        const fixed = original.get(i.id);
        return fixed ? { ...fixed, zoneId: i.zoneId } : i;
      }), groups: accepted.groups, clearance: options.aisleMm }), warnings, score };
    }
  }
  const { project, warnings } = best!;
  return { project: { ...project, basicDraft: { business, warnings } }, warnings };
}
