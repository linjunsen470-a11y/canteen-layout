import type { generateBasicLayoutCandidates } from './basicLayout';
import type { ConceptBusinessType } from './conceptPlanner';
import type { Project } from './model';

export function requestLayoutCandidates(project: Project, business: ConceptBusinessType, signal?: AbortSignal) {
  return new Promise<ReturnType<typeof generateBasicLayoutCandidates>>((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./basicLayout.worker.ts', import.meta.url), { type: 'module' });
    function finish() {
      worker.terminate();
      signal?.removeEventListener('abort', cancel);
    }
    function cancel() {
      finish();
      reject(new DOMException('已取消试排', 'AbortError'));
    }
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    const fail = () => {
      finish();
      reject(new Error('基础布局生成失败，请重试'));
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    try { worker.postMessage([project, business]); }
    catch { fail(); }
  });
}
