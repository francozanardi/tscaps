import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { CaptionElement, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';

/** The scenes a list of refs named, each once in the order given, or why some of the refs name none. */
export type SceneRefsReading =
  | { readonly ok: true; readonly scenes: ReadonlyArray<CaptionElement> }
  | { readonly ok: false; readonly problems: ReadonlyArray<OperationProblem> };

/**
 * Reads a list of scene refs (`segment:<id>`) against the captions on
 * screen now. Every ref is checked: one that is not a scene there makes
 * the whole list fail, so a caller changes nothing on a partly stale list.
 */
export class SceneRefsReader {
  constructor(private readonly captions: CaptionRefResolver) {}

  read(refs: ReadonlyArray<string>): SceneRefsReading {
    const resolved = refs.map((ref) => this.captions.resolve(ref, ['segment']));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return { ok: false, problems };
    const scenes = resolved.flatMap((each) => (each.ok ? [each.value] : []));
    return { ok: true, scenes: [...new Map(scenes.map((scene) => [scene.id, scene])).values()] };
  }
}
