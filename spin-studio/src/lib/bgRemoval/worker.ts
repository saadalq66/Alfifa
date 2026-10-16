import { preload, removeBackground, type Config } from '@imgly/background-removal';
import type { Stage, WorkerRequest, WorkerResponse } from './protocol';

// Inference runs here, off the main thread, so the viewer stays smooth while
// a whole sequence is processed. Without cross-origin isolation (which static
// hosts like GitHub Pages cannot enable) the WASM backend is single-threaded
// and each image would otherwise freeze the page for seconds.

const post = (message: WorkerResponse) => self.postMessage(message);

let currentId = '';

// The library memoises its session together with the *first* config it saw,
// including this callback, so it must be one stable function for all jobs.
const progress = (key: string, current: number, total: number) => {
  if (key.startsWith('fetch:')) {
    post({ type: 'download', key: key.slice(6), loaded: current, total });
  } else if (key.startsWith('compute:') && currentId) {
    post({ type: 'stage', id: currentId, stage: key.slice(8) as Stage });
  }
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, image, device, publicPath } = event.data;
  currentId = id;
  const config: Config = {
    device,
    model: 'isnet_fp16',
    output: { format: 'image/png' },
    progress,
    ...(publicPath ? { publicPath } : {}),
  };

  try {
    await preload(config);
  } catch (error) {
    post({ type: 'error', id, phase: 'init', message: describe(error) });
    return;
  }

  try {
    const result = await removeBackground(image, config);
    post({ type: 'done', id, image: result });
  } catch (error) {
    post({ type: 'error', id, phase: 'run', message: describe(error) });
  } finally {
    currentId = '';
  }
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
