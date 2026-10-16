import {
  clamp,
  easeOutCubic,
  pixelsPerFrame,
  recentVelocity,
  shortestDelta,
  wrapIndex,
} from './spinMath';

export interface SpinState {
  index: number;
  count: number;
  playing: boolean;
  loaded: number;
  /** Becomes true on the first drag, key press or swipe — used to hide the hint. */
  interacted: boolean;
  dragging: boolean;
}

export interface SpinOptions {
  fps: number;
  invertDrag: boolean;
  onChange: (state: SpinState) => void;
}

const MAX_DPR = 2;
const FRICTION_PER_FRAME = 0.94;
const MIN_FLING = 0.004; // frames per ms
const MAX_FLING = 0.12;

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
}

/**
 * Framework-free 360° player. Owns the canvas, input handling and animation
 * loop so scrubbing never waits on React renders.
 *
 * `position` is a continuous frame coordinate; the visible frame is
 * position rounded and wrapped onto the sequence.
 */
export class SpinEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cache = new Map<string, HTMLImageElement>();
  private readonly ready = new WeakSet<HTMLImageElement>();
  private images: HTMLImageElement[] = [];
  private position = 0;
  private drawnIndex = -1;
  private drawnImage: HTMLImageElement | null = null;
  private needsDraw = true;

  private playing = false;
  private velocity = 0;
  private tween: Tween | null = null;
  private drag: { pointerId: number; startX: number; startPosition: number } | null = null;
  private samples: { t: number; x: number }[] = [];
  private interacted = false;
  private visible = true;

  private rafId = 0;
  private lastTick = 0;
  private lastEmitted = '';
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver | null;

  constructor(
    private readonly surface: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private options: SpinOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported.');
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(surface);
    this.intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
            this.schedule();
          });
    this.intersectionObserver?.observe(surface);

    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointercancel', this.onPointerCancel);
    surface.addEventListener('lostpointercapture', this.onPointerCancel);
    surface.addEventListener('wheel', this.onWheel, { passive: false });
    surface.addEventListener('keydown', this.onKeyDown);
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    const s = this.surface;
    s.removeEventListener('pointerdown', this.onPointerDown);
    s.removeEventListener('pointermove', this.onPointerMove);
    s.removeEventListener('pointerup', this.onPointerUp);
    s.removeEventListener('pointercancel', this.onPointerCancel);
    s.removeEventListener('lostpointercapture', this.onPointerCancel);
    s.removeEventListener('wheel', this.onWheel);
    s.removeEventListener('keydown', this.onKeyDown);
    this.cache.clear();
    this.images = [];
  }

  setOptions(options: Partial<SpinOptions>) {
    this.options = { ...this.options, ...options };
  }

  /** Swaps the frame list, reusing already-decoded images by URL. */
  setFrames(urls: readonly string[]) {
    const next = new Map<string, HTMLImageElement>();
    this.images = urls.map((url) => {
      let img = next.get(url) ?? this.cache.get(url);
      if (!img) {
        img = new Image();
        img.decoding = 'async';
        const image = img;
        image.onload = () => {
          image
            .decode()
            .catch(() => undefined)
            .then(() => {
              this.ready.add(image);
              this.needsDraw = true;
              this.schedule();
              this.emit();
            });
        };
        image.src = url;
      }
      next.set(url, img);
      return img;
    });
    this.cache.clear();
    next.forEach((img, url) => this.cache.set(url, img));
    if (this.images.length === 0) this.position = 0;
    this.needsDraw = true;
    this.schedule();
    this.emit();
  }

  get index() {
    return wrapIndex(this.position, this.images.length);
  }

  play() {
    if (this.images.length < 2) return;
    this.tween = null;
    this.velocity = 0;
    this.playing = true;
    this.lastTick = 0;
    this.schedule();
    this.emit();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Spins back to the first frame along the shorter direction. */
  reset() {
    this.pause();
    this.goTo(0);
  }

  goTo(index: number, animate = true) {
    const count = this.images.length;
    if (count === 0) return;
    this.velocity = 0;
    const delta = shortestDelta(this.position, index, count);
    if (!animate || Math.abs(delta) < 0.5) {
      this.tween = null;
      this.position += delta;
      this.needsDraw = true;
    } else {
      this.tween = {
        from: this.position,
        to: this.position + delta,
        start: performance.now(),
        duration: clamp(Math.abs(delta) * 28, 220, 700),
      };
    }
    this.schedule();
    this.emit();
  }

  step(delta: number) {
    this.markInteracted();
    this.pause();
    this.goTo(wrapIndex(Math.round(this.position) + delta, this.images.length), false);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  private onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.drag || this.images.length < 2) return;
    this.surface.setPointerCapture?.(event.pointerId);
    this.markInteracted();
    this.pause();
    this.tween = null;
    this.velocity = 0;
    this.drag = { pointerId: event.pointerId, startX: event.clientX, startPosition: this.position };
    this.samples = [{ t: event.timeStamp, x: event.clientX }];
    this.emit();
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const dx = event.clientX - this.drag.startX;
    this.position = this.drag.startPosition - (dx / this.pxPerFrame()) * this.direction();
    this.samples.push({ t: event.timeStamp, x: event.clientX });
    if (this.samples.length > 12) this.samples.shift();
    this.needsDraw = true;
    this.schedule();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.samples.push({ t: event.timeStamp, x: event.clientX });
    const pxPerMs = recentVelocity(this.samples);
    this.drag = null;
    const velocity = -(pxPerMs / this.pxPerFrame()) * this.direction();
    if (Math.abs(velocity) > MIN_FLING) {
      this.velocity = clamp(velocity, -MAX_FLING, MAX_FLING);
      this.lastTick = 0;
      this.schedule();
    }
    this.emit();
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.drag = null;
    this.emit();
  };

  private onWheel = (event: WheelEvent) => {
    // Only horizontal trackpad swipes rotate; vertical wheel keeps scrolling the page.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || this.images.length < 2) return;
    event.preventDefault();
    this.markInteracted();
    if (this.playing) this.pause();
    this.tween = null;
    this.velocity = 0;
    const pixels = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaX;
    this.position += (pixels / this.pxPerFrame()) * this.direction();
    this.needsDraw = true;
    this.schedule();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        this.step(1);
        break;
      case 'ArrowLeft':
        this.step(-1);
        break;
      case ' ':
      case 'Enter':
        this.markInteracted();
        this.toggle();
        break;
      case 'Home':
        this.markInteracted();
        this.reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  private markInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    this.emit();
  }

  private direction() {
    return this.options.invertDrag ? -1 : 1;
  }

  private pxPerFrame() {
    return pixelsPerFrame(this.surface.clientWidth || 600, this.images.length);
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.round(this.surface.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.surface.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.needsDraw = true;
      this.draw();
    }
  }

  private schedule() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.rafId = 0;
    const dt = this.lastTick ? Math.min(now - this.lastTick, 64) : 16.7;
    this.lastTick = now;
    let animating = false;

    if (this.tween) {
      const t = clamp((now - this.tween.start) / this.tween.duration, 0, 1);
      this.position = this.tween.from + (this.tween.to - this.tween.from) * easeOutCubic(t);
      this.needsDraw = true;
      if (t >= 1) this.tween = null;
      else animating = true;
    } else if (this.velocity !== 0 && !this.drag) {
      this.position += this.velocity * dt;
      this.velocity *= Math.pow(FRICTION_PER_FRAME, dt / 16.7);
      if (Math.abs(this.velocity) < MIN_FLING / 3) this.velocity = 0;
      else animating = true;
      this.needsDraw = true;
    } else if (this.playing && !this.drag) {
      this.position += (this.options.fps * dt) / 1000;
      this.needsDraw = true;
      animating = true;
    }

    // Keep positions small so floating point never drifts on long sessions.
    const count = this.images.length;
    if (count > 0 && Math.abs(this.position) > count * 1000 && !this.tween && !this.drag) {
      this.position %= count;
    }

    this.draw();
    this.emit();
    if (animating && this.visible) this.schedule();
    else this.lastTick = 0;
  };

  private draw() {
    const count = this.images.length;
    const { ctx, canvas } = this;
    if (count === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawnIndex = -1;
      this.drawnImage = null;
      return;
    }
    const index = this.index;
    const image = this.nearestReady(index);
    if (!this.needsDraw && index === this.drawnIndex && image === this.drawnImage) return;
    this.needsDraw = false;
    this.drawnIndex = index;
    this.drawnImage = image;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!image) return;
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  /** While frames stream in, show the closest one that has loaded instead of a blank. */
  private nearestReady(index: number): HTMLImageElement | null {
    const count = this.images.length;
    for (let offset = 0; offset <= count / 2; offset++) {
      const a = this.images[(index + offset) % count];
      if (this.ready.has(a)) return a;
      const b = this.images[(index - offset + count) % count];
      if (this.ready.has(b)) return b;
    }
    return null;
  }

  private emit() {
    const state: SpinState = {
      index: this.index,
      count: this.images.length,
      playing: this.playing,
      loaded: this.images.filter((img) => this.ready.has(img)).length,
      interacted: this.interacted,
      dragging: this.drag !== null,
    };
    const key = `${state.index}|${state.count}|${state.playing}|${state.loaded}|${state.interacted}|${state.dragging}`;
    if (key === this.lastEmitted) return;
    this.lastEmitted = key;
    this.options.onChange(state);
  }
}
