export type Device = 'gpu' | 'cpu';

export type WorkerRequest = {
  type: 'process';
  id: string;
  image: Blob;
  device: Device;
  publicPath?: string;
};

export type WorkerResponse =
  | { type: 'download'; key: string; loaded: number; total: number }
  | { type: 'stage'; id: string; stage: Stage }
  | { type: 'done'; id: string; image: Blob }
  /** `phase: 'init'` means the model could not be loaded at all. */
  | { type: 'error'; id: string; phase: 'init' | 'run'; message: string };

export type Stage = 'decode' | 'inference' | 'mask' | 'encode';
