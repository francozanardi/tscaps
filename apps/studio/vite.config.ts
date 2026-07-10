import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@tscaps/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
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
