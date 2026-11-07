import type { InterpolateRequest, InterpolateResponse } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (frames: Blob[]) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<InterpolateResponse>) => {
      const job = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (!job) return;
      if (event.data.ok) job.resolve(event.data.frames);
      else job.reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      for (const job of pending.values()) job.reject(new Error(event.message || 'Frame generation failed.'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/** Generates the frames between two photos at the given times (0–1). */
export function interpolatePair(a: Blob, b: Blob, times: number[]): Promise<Blob[]> {
  const id = nextId++;
  // Cut-outs need transparency; photos are smaller as JPEG.
  const format = a.type === 'image/png' || b.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: InterpolateRequest = { id, a, b, times, format };
    getWorker().postMessage(request);
  });
}
