import type { Item, Project } from './model';
import { cornerDistance, surveyWall } from './interiorSurvey';
import { useWorkspace } from './workspace';

export default function SurveyDimension({ project, item, scale }: { project: Project; item?: Item; scale: number }) {
  const fromEnd = useWorkspace(s => s.surveyFromEnd);
  const wall = item?.kind === 'wall' ? item : item?.wallId ? project.items.find(i => i.id === item.wallId) : undefined;
  if (!item || !wall) return null;
  const datum = surveyWall(project, wall);
  if (!datum) return null;
  const isWall = item.kind === 'wall';
  const reverse = !isWall && fromEnd;
  const a = reverse ? datum.b : datum.a, b = reverse ? datum.a : datum.b;
  const length = isWall ? datum.end - datum.start : cornerDistance(datum,item.offset!,item.w,fromEnd);
  const angle = Math.atan2(b.y-a.y,b.x-a.x) * 180 / Math.PI;
  const t = 4 / scale, y = -12 / scale;
  const label = (isWall ? '内净长 ' : reverse ? '末角 ' : '起角 ') + Math.round(length * 1000) / 1000 + ' mm';
  return <g data-ui="true" data-survey-dimension="" pointerEvents="none" transform={'translate('+a.x+' '+a.y+') rotate('+angle+')'}>
    <path d={'M0 0 V'+(y-t)+' M0 '+y+' H'+length+' M'+length+' 0 V'+(y-t)} fill="none" stroke="#87551d" strokeWidth={1.5/scale} />
    <g transform={'translate('+length/2+' '+(y-2*t)+') rotate('+(angle>90 || angle<=-90 ? 180 : 0)+')'}>
      <text textAnchor="middle" dominantBaseline="middle" fontSize={12/scale} fill="#714413" stroke="#fff" strokeWidth={3/scale} paintOrder="stroke">{label}</text>
    </g>
  </g>;
}
