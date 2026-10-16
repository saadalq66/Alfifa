# Spin Studio — 360° product spins in the browser

Turn a sequence of photos (a car, a wristwatch, any product) into an interactive
360° spin. Everything runs client-side, so the app is a static site you can host
for free on GitHub Pages, Vercel, Netlify or any static file host.

## Features

- **Upload & order** — drop or pick many JPEG/PNG/WebP photos at once. They are
  sorted naturally by file name (`IMG_2` before `IMG_10`), and the thumbnail grid
  can be re-ordered by drag and drop (mouse, long-press on touch screens, or
  keyboard: <kbd>Space</kbd> to pick up, arrow keys to move, <kbd>Space</kbd> to drop).
  "Sort by name", "Reverse" and "Clear all" help fix the sequence quickly.
- **Remove Backgrounds** — one switch cuts the object out of every frame with
  [`@imgly/background-removal`](https://github.com/imgly/background-removal-js),
  running in a Web Worker (WebGPU when available, WASM otherwise) so the UI stays
  smooth. Each thumbnail shows its own progress ring; results are cached, so
  toggling off and on is instant.
- **360° viewer** — drag with the mouse, swipe on touch screens, use a trackpad's
  horizontal swipe or the arrow keys. Releasing a drag keeps spinning with
  momentum. Controls below the viewer: **Play/Pause Auto-Rotate** and **Reset View**
  (spins back to the first frame along the shorter way), plus full screen,
  rotation speed, drag direction and backdrop settings.
- **Share Project** — a view-only link and an `<iframe>` embed code. Opening the
  link shows *only* the viewer, full-bleed, ready to embed on other sites.
- **Export Project** — a ZIP with every processed frame (PNG cut-outs or the
  original JPEGs), a `spin.json` manifest and a dependency-free `index.html`
  viewer, so the folder can be hosted as-is.
- A **sample product** is generated procedurally on a canvas, for the hero demo
  and the "Try sample photos" button.

## Getting started

Requires Node.js 20.19+ (or 22.12+).

```bash
cd spin-studio
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Deploying (free)

The build uses relative asset paths and hash-based share links, so `dist/` works
from a domain root or any sub-path, with no server rewrites.

**GitHub Pages** — the workflow in `.github/workflows/spin-studio.yml` tests and
builds the app on every pull request that touches `spin-studio/`, and deploys it
on pushes to `main`. One-time setup: *Settings → Pages → Build and deployment →
Source: **GitHub Actions***. The app is then served at
`https://<user>.github.io/<repo>/`.

**Vercel** — import the repository, set *Root Directory* to `spin-studio`; the Vite
preset (`npm run build`, output `dist`) is detected automatically.

**Anything else** — run `npm run build` and upload `dist/`.

## How share links work (no database)

Share links carry the entire spin inside the URL fragment: `…/#spin=<data>`.
Browsers never send the fragment to the server, so the hosting provider never
sees the images, and there is nothing to store or pay for.

1. Frames are downscaled (Small 360 px · Balanced 540 px · Sharp 800 px on the
   long edge) and re-encoded as WebP (JPEG where the browser cannot encode WebP).
2. Unless the backdrop is *Transparent*, the backdrop is painted into every
   frame. An opaque WebP is roughly 4× smaller than one with an alpha channel
   (measured on 35 cut-outs at 540 px: 137 KB vs 591 KB). The backdrops are
   designed to fade to a solid edge colour, so the viewer can letterbox baked
   frames seamlessly at any window size.
3. The frames and viewer settings are packed into a small binary container and
   encoded as base64url — the densest URL-safe text encoding.

General-purpose compression such as `lz-string` is deliberately **not** used:
WebP/JPEG data is already compressed, and on a real 35-frame payload lz-string
made the link 17% *longer* (881 K vs 753 K characters).

Measured on a 36-frame spin: *Small* ≈ 128 K characters, *Balanced* ≈ 217 K,
*Sharp* ≈ 383 K; "Use every other frame" halves that (≈ 64 K / 108 K). The share dialog shows
the exact size, previews exactly what viewers will get, and warns when a link is
getting long. Links of a few hundred KB open fine in browsers and work well as
embeds, but chat apps may refuse to send them — use *Small* plus every other
frame for links you intend to paste into messages. A truncated link shows a
friendly "this link is incomplete" page rather than a broken viewer.

## Background removal

- The AI model (~88 MB) and the onnxruntime WASM binary are downloaded from
  IMG.LY's CDN on first use — about 100 MB in total. Photos are processed
  locally and never uploaded.
- To self-host those files (for example from a network that blocks the CDN),
  copy the contents of the `@imgly/background-removal-data` package that matches
  the library version to your host and build with
  `VITE_BG_REMOVAL_PUBLIC_PATH=https://your.host/path/ npm run build` (trailing
  slash required).
- GitHub Pages cannot send the headers needed for cross-origin isolation, so
  the WASM backend runs single-threaded there; browsers with WebGPU are much
  faster.

### Licensing note

`@imgly/background-removal` is licensed under the **AGPL-3.0** (commercial
licences are available from IMG.LY). If you deploy this app publicly, the AGPL
generally requires that its source code is available to users — keeping this
repository public satisfies that. Check the licence terms for your situation.

## Project layout

```
src/
  main.tsx                 picks the editor or the view-only viewer from the URL hash
  EditorApp.tsx            landing page + studio
  ViewerApp.tsx            view-only mode for share links and iframes
  components/
    SpinViewer.tsx         React wrapper: stage, overlays and controls
    FrameGrid.tsx          sortable thumbnail grid (dnd-kit)
    ShareModal.tsx         link quality, preview, link + embed code
    Studio.tsx, Dropzone.tsx, Modal.tsx, Toast.tsx, ui.tsx, landing/
  hooks/
    useFrames.ts           ordered frame list and object-URL lifecycle
    useBackgroundRemoval.ts  sequential processing queue
  lib/
    spinEngine.ts          framework-free player: canvas, input, inertia, autoplay
    spinMath.ts            frame/position maths (unit tested)
    sharePayload.ts        binary share-link format + base64url (unit tested)
    share.ts               frame re-encoding, link and embed generation
    backdrops.ts           backdrop definitions shared by CSS, canvas and export
    exportZip.ts           ZIP export with a standalone viewer
    bgRemoval/             Web Worker + client for @imgly/background-removal
    sample.ts              procedural sample product
```

Imported photos are normalised to at most 1600 px on the long edge. That keeps
dozens of decoded frames within phone memory limits and background removal fast,
and it strips EXIF metadata such as GPS location before anything is shared or
exported.
