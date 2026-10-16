export type BackdropId = 'studio' | 'white' | 'gray' | 'dark' | 'transparent';

/** Order matters: the index is what share links store. Append new backdrops at the end. */
export const BACKDROP_IDS: readonly BackdropId[] = ['studio', 'white', 'gray', 'dark', 'transparent'];

export interface ViewerSettings {
  /** Auto-rotate speed in frames per second. */
  fps: number;
  /** Flip which way dragging turns the object. */
  invertDrag: boolean;
  backdrop: BackdropId;
}

export type BgStatus = 'idle' | 'processing' | 'done' | 'error';

export interface Cutout {
  blob: Blob;
  url: string;
  thumbUrl: string;
}

export interface Frame {
  id: string;
  name: string;
  width: number;
  height: number;
  /** The imported photo, normalised to at most MAX_FRAME_EDGE on its long side. */
  blob: Blob;
  url: string;
  thumbUrl: string;
  cutout?: Cutout;
  bg: {
    status: BgStatus;
    /** 0–1 progress of the current background-removal job. */
    progress: number;
    stage?: string;
    error?: string;
  };
}
