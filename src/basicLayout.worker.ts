import { generateBasicLayout } from './basicLayout';

self.onmessage = ({ data }: MessageEvent<Parameters<typeof generateBasicLayout>>) => {
  try { self.postMessage({ result: generateBasicLayout(...data) }); }
  catch (error) { self.postMessage({ error: (error as Error).message }); }
};
