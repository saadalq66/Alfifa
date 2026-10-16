import { BG_REMOVAL_PUBLIC_PATH } from '../../config';
import type { Device, Stage, WorkerRequest, WorkerResponse } from './protocol';

export type { Stage };

export class BackgroundRemovalError extends Error {
  override name = 'BackgroundRemovalError';
  constructor(
    message: string,
    /** 'init' means the AI model could not be loaded, so every image would fail. */
    readonly phase: 'init' | 'run',
  ) {
    super(message);
  }
}

interface PendingJob {
  resolve: (image: Blob) => void;
  reject: (error: BackgroundRemovalError) => void;
  onStage?: (stage: Stage) => void;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

/**
 * Talks to the background-removal worker. Tries WebGPU first and transparently
 * falls back to the WASM (CPU) backend if the GPU path fails.
 */
class BackgroundRemover {
  private worker: Worker | null = null;
  private readonly jobs = new Map<string, PendingJob>();
  private readonly downloads = new Map<string, DownloadProgress>();
  private device: Device = 'gpu';
  onDownload?: (progress: DownloadProgress) => void;

  async process(id: string, image: Blob, onStage?: (stage: Stage) => void): Promise<Blob> {
    try {
      return await this.run(id, image, onStage);
    } catch (error) {
      if (this.device === 'gpu' && error instanceof BackgroundRemovalError) {
        console.warn('WebGPU background removal failed, retrying on CPU:', error.message);
        this.device = 'cpu';
        this.reset();
        return this.run(id, image, onStage);
      }
      throw error;
    }
  }

  /** Terminates the worker. The next job starts a fresh one. */
  reset() {
    this.worker?.terminate();
    this.worker = null;
    this.downloads.clear();
    for (const job of this.jobs.values()) {
      job.reject(new BackgroundRemovalError('Background removal was restarted.', 'init'));
    }
    this.jobs.clear();
  }

  private run(id: string, image: Blob, onStage?: (stage: Stage) => void): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.jobs.set(id, { resolve, reject, onStage });
      const request: WorkerRequest = {
        type: 'process',
        id,
        image,
        device: this.device,
        publicPath: BG_REMOVAL_PUBLIC_PATH,
      };
      this.getWorker().postMessage(request);
    });
  }

  private getWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        const message = event.message || 'The background removal worker crashed.';
        const jobs = [...this.jobs.values()];
        this.jobs.clear();
        this.reset();
        for (const job of jobs) job.reject(new BackgroundRemovalError(message, 'init'));
      };
      this.worker = worker;
    }
    return this.worker;
  }

  private handle(message: WorkerResponse) {
    switch (message.type) {
      case 'download': {
        this.downloads.set(message.key, { loaded: message.loaded, total: message.total });
        let loaded = 0;
        let total = 0;
        for (const entry of this.downloads.values()) {
          loaded += entry.loaded;
          total += entry.total;
        }
        this.onDownload?.({ loaded, total });
        return;
      }
      case 'stage':
        this.jobs.get(message.id)?.onStage?.(message.stage);
        return;
      case 'done': {
        const job = this.jobs.get(message.id);
        this.jobs.delete(message.id);
        job?.resolve(message.image);
        return;
      }
      case 'error': {
        const job = this.jobs.get(message.id);
        this.jobs.delete(message.id);
        // The library caches a failed model load, so only a new worker can retry it.
        if (message.phase === 'init') this.reset();
        job?.reject(new BackgroundRemovalError(message.message, message.phase));
        return;
      }
    }
  }
}

export const backgroundRemover = new BackgroundRemover();
