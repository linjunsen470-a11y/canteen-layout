import { RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as T from 'three';
import { Project, resolveStyle } from './model';
import { readAsset } from './projectLibrary';
import { SceneCaptureAPI, SceneGalleryShots } from './SceneCapture';
import SceneContent, { atmosphereConfig } from './SceneContent';

export type OffscreenStageHandle = {
  captureShot: (kind: keyof SceneGalleryShots) => string;
  dispose: () => void;
};

const UNDERLAY_MISSING_ERROR = '底图未加载完成或资产缺失，请先恢复底图后截图';

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function OffscreenCanvas({
  project,
  capture,
  onCreated,
  onUnderlayError,
}: {
  project: Project;
  capture: RefObject<SceneCaptureAPI | null>;
  onCreated: (gl: T.WebGLRenderer) => void;
  onUnderlayError: (error: string) => void;
}) {
  const cfg = atmosphereConfig[resolveStyle(project).lightingPreset];
  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={1}
      camera={{ position: [14, 12, 16], fov: 40 }}
      gl={{
        preserveDrawingBuffer: true,
        localClippingEnabled: true,
        antialias: true,
        toneMapping: T.ACESFilmicToneMapping,
        toneMappingExposure: cfg.exposure,
      }}
      onCreated={({ gl }) => onCreated(gl)}
    >
      <SceneContent
        project={project}
        interactive={false}
        capture={capture}
        onUnderlayError={onUnderlayError}
      />
    </Canvas>
  );
}

// Mounts a temporary offscreen 3D canvas for read-only rendering without touching the active store.
export async function openOffscreenStage(
  project: Project,
  options: { timeoutMs?: number } = {},
): Promise<OffscreenStageHandle> {
  const underlay = project.underlay && !project.underlay.hidden ? project.underlay : null;
  if (underlay) {
    const asset = await readAsset(underlay.assetId);
    if (!asset) throw Error(UNDERLAY_MISSING_ERROR);
  }

  const host = document.createElement('div');
  host.setAttribute('data-offscreen-stage', 'true');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '1600px',
    height: '1000px',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(host);

  const capture: RefObject<SceneCaptureAPI | null> = { current: null };
  let gl: T.WebGLRenderer | null = null;
  let underlayError = '';
  let disposed = false;

  const root = createRoot(host);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    root.unmount();
    if (gl) {
      gl.dispose();
      gl.forceContextLoss?.();
      gl = null;
    }
    host.remove();
  };

  try {
    root.render(
      <OffscreenCanvas
        project={project}
        capture={capture}
        onCreated={renderer => { gl = renderer; }}
        onUnderlayError={msg => { underlayError = msg || UNDERLAY_MISSING_ERROR; }}
      />,
    );

    const deadline = Date.now() + (options.timeoutMs ?? 15000);
    while (Date.now() < deadline) {
      if (underlayError) throw Error(UNDERLAY_MISSING_ERROR);
      const api = capture.current;
      if (api?.galleryReady() && (!underlay || api.underlayReady(underlay.assetId))) break;
      await new Promise<void>(resolve => setTimeout(resolve, 40));
    }

    if (underlayError) throw Error(UNDERLAY_MISSING_ERROR);
    if (!capture.current?.galleryReady()) throw Error('离屏三维视图尚未就绪，请稍后重试');
    if (underlay && !capture.current.underlayReady(underlay.assetId)) throw Error(UNDERLAY_MISSING_ERROR);

    await nextFrame();
    await nextFrame();
    await new Promise<void>(resolve => setTimeout(resolve, 60));

    return {
      captureShot: kind => {
        if (disposed || !capture.current) throw Error('离屏三维场景已释放');
        return capture.current.captureShot(project, kind);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export async function withOffscreenStage<T>(
  project: Project,
  task: (stage: Pick<OffscreenStageHandle, 'captureShot'>) => T | Promise<T>,
  options?: { timeoutMs?: number },
): Promise<T> {
  const stage = await openOffscreenStage(project, options);
  try {
    return await task(stage);
  } finally {
    stage.dispose();
  }
}
