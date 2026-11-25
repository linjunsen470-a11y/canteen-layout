import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Project } from './model';
import { readAsset } from './projectLibrary';
import { blobDataURL } from './imageAssets';
import { capturePlan, type CapturePlanOptions } from './capturePlan';
import PlanReadonlySVG from './PlanReadonlySVG';

const UNDERLAY_MISSING_ERROR = '底图未加载完成或资产缺失，请先恢复底图后导出';

// Rasterizes any Project to a 2D architectural plan PNG offscreen without touching the active editor or store.
export async function capturePlanFromProject(project: Project, options: CapturePlanOptions = {}): Promise<string> {
  let underlayUrl: string | undefined;
  if (project.underlay && !project.underlay.hidden) {
    const asset = await readAsset(project.underlay.assetId);
    if (!asset) throw Error(UNDERLAY_MISSING_ERROR);
    underlayUrl = await blobDataURL(asset.blob);
  }

  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(<PlanReadonlySVG project={project} underlayUrl={underlayUrl} />);
    });
    const svg = host.querySelector('svg');
    if (!svg) throw Error('平面图导出失败');
    return await capturePlan(svg, project, options);
  } finally {
    root.unmount();
    host.remove();
  }
}
