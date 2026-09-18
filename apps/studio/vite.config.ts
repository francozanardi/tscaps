import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  // `es` rather than the `iife` default, because a worker whose graph
  // contains a dynamic import has to be split across chunks and an IIFE
  // cannot be. Every `new Worker` here already passes `{ type: 'module' }`,
  // so the app requires module workers whatever the bundle's shape.
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // The runtime is imported with `?url` from inside node_modules,
    // so Vite's pre-alias plugin registers it as a dependency to
    // pre-bundle, drops the `?url`, and then serves 404s for a file
    // the optimizer never emits. Excluding the alias keeps the
    // import what it is: an asset URL.
    exclude: ['@mediapipe-runtime'],
  },
  resolve: {
    alias: {
      // MediaPipe publishes its WebAssembly runtime inside the package but
      // names no subpath for it in `exports`, so it can only be reached by
      // path. Serving it ourselves is what keeps the person segmenter off a
      // third-party host.
      '@mediapipe-runtime': resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm'),
      '@tscaps/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@shared/telemetry': resolve(__dirname, './shared/telemetry/index.ts'),
      '@shared/transcription-languages': resolve(__dirname, './shared/transcription-languages/index.ts'),
      '@shared/browser': resolve(__dirname, './shared/browser/index.ts'),
      '@modules': resolve(__dirname, '../../packages/engine/src/modules'),
      '@bootstrap': resolve(__dirname, 'src/bootstrap'),
      '@core': resolve(__dirname, 'src/core'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    host: true,
  },
});
