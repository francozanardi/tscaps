import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: path.join(here, 'index.html'),
        fromText: path.join(here, 'from-text/index.html'),
        transcribe: path.join(here, 'transcribe/index.html'),
        cssAlignment: path.join(here, 'css-alignment/index.html'),
        cliRunner: path.join(here, 'cli/runner.html'),
        cliReadmeRunner: path.join(here, 'cli/readme-runner.html'),
      },
    },
  },
});
