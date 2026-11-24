import type { generateBasicLayout } from './basicLayout';

export function requestBasicLayout(...args: Parameters<typeof generateBasicLayout>) {
  return new Promise<ReturnType<typeof generateBasicLayout>>((resolve, reject) => {
    const worker = new Worker(new URL('./basicLayout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    const fail = () => {
      worker.terminate();
      reject(new Error('基础布局生成失败，请重试'));
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    try {
      worker.postMessage(args);
    } catch {
      fail();
    }
  });
}
