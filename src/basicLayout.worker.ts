import { generateBasicLayoutCandidates } from './basicLayout';

self.onmessage = ({ data }: MessageEvent<Parameters<typeof generateBasicLayoutCandidates>>) => {
  try { self.postMessage({ result: generateBasicLayoutCandidates(...data) }); }
  catch (error) { self.postMessage({ error: (error as Error).message }); }
};
