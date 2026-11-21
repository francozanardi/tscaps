import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'sass';
import { CssMinifier } from '@tscaps/engine/advanced';
import type { ShotLayerStageCss } from '@core/shots/domain/ShotLayerStageCss';

const OUTPUT_FILE = 'stage.build.json';
const minifier = new CssMinifier();

/**
 * Compiles the shot layers' stage stylesheets — the layout framework
 * every layer's box is built by, and how each transition between shots
 * plays — and writes them beside their sources, for studio to put in
 * their cascade layers.
 */
export function buildLayerStage(stageDir: string): void {
  const built: ShotLayerStageCss = {
    framework: minifier.minify(compile(join(stageDir, 'stage.scss')).css),
    shotTransitions: minifier.minify(compile(join(stageDir, 'shot-transitions.scss')).css),
  };
  writeFileSync(join(stageDir, OUTPUT_FILE), `${JSON.stringify(built, null, 2)}\n`);
  console.log(`✓ the shot layers' stage built to layer/stage/${OUTPUT_FILE}.`);
}
