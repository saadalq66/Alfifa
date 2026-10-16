import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * onnxruntime-web references its WASM binary (~24 MB) and its own bundle via
 * `new URL('…', import.meta.url)`, which makes Vite copy them into dist/.
 * @imgly/background-removal always points onnxruntime at files fetched from its
 * own `publicPath`, so those copies would never be requested. Making the URL
 * non-literal stops Vite from emitting them without changing runtime behaviour.
 */
function skipUnusedOnnxAssets(): Plugin {
  return {
    name: 'skip-unused-onnx-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('onnxruntime-web')) return null;
      return code.replace(
        /new URL\((["'])([^"']+)\1,\s*import\.meta\.url\)/g,
        'new URL($1$2$1 + "", import.meta.url)',
      );
    },
  };
}

export default defineConfig({
  // Relative asset paths let the same build run from a domain root (Vercel)
  // or from a sub-path such as https://<user>.github.io/<repo>/ (GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), skipUnusedOnnxAssets()],
  worker: {
    // The background-removal worker lazy-loads onnxruntime, which needs code splitting.
    format: 'es',
    plugins: () => [skipUnusedOnnxAssets()],
  },
  optimizeDeps: {
    exclude: ['@imgly/background-removal', 'onnxruntime-web'],
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
