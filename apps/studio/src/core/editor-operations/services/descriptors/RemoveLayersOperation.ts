import { z } from 'zod';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ProjectLayer, ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { RemoveShotLayersAction } from '@core/shots/actions/RemoveShotLayersAction';

/**
 * `remove_layers`: takes layers off their shots. A ref that names no
 * layer any more is answered with a problem and the others are still
 * removed: a layer already gone is what the caller wanted anyway.
 */
export class RemoveLayersOperation implements EditorOperation {
  readonly name = 'remove_layers';
  readonly effect = 'edit';
  readonly description = [
    'Take layers (b-roll, pictures, GIFs, graphics) off their shots, wherever those are; the shot shows what is beneath them again (its own video where nothing else is).',
    'The files stay in the person\'s media. Sounds anchored to a removed layer (its entrance, exit, transitions, camera or a graphic\'s moments) stop playing; a warning names them.',
    'A shot\'s own video is not a layer and cannot be removed.',
  ].join(' ');

  private readonly input = new OperationInput({
    layers: z.array(z.string()).min(1).max(50).describe('The layers to remove, as refs (layer:<id>).'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly parser: EditorRefParser,
    private readonly remove: RemoveShotLayersAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return { ok: false, output: null, problems: checked.problems };
    const layers: ProjectLayer[] = [];
    const problems: OperationProblem[] = [];
    for (const ref of new Set(checked.value.layers)) {
      const layer = this.shots.resolveLayer(ref);
      if (layer.ok) layers.push(layer.value);
      else problems.push(layer.problem);
    }
    if (layers.length === 0) return { ok: false, output: null, problems };
    const silenced = this.soundsOn(new Set(layers.map((each) => each.layer.id)));
    this.remove.execute(layers.map((each) => each.layer.id), 'assistant');
    if (silenced.length > 0) {
      problems.push({ severity: 'warning', message: `These sounds were anchored to the removed layers and no longer play: ${silenced.join(', ')}` });
    }
    return { ok: true, output: { removed: layers.map((each) => each.ref) }, problems };
  }

  /** The refs of the sounds anchored to one of `layerIds`. */
  private soundsOn(layerIds: ReadonlySet<string>): string[] {
    return this.store.snapshot().audio.clips()
      .filter((clip) => this.namesLayer(clip.start.anchor, layerIds))
      .map((clip) => this.parser.formatOf('sound', clip.id));
  }

  private namesLayer(anchor: AudioAnchor, layerIds: ReadonlySet<string>): boolean {
    switch (anchor.kind) {
      case 'layer':
      case 'layer-transition':
      case 'layer-moment':
      case 'layer-camera':
        return layerIds.has(anchor.layerId);
      default:
        return false;
    }
  }
}
