import type { EffectConfig } from '@core/effect/domain/EffectConfig';
import {
  Decoration,
  Document,
  Line,
  Section,
  Segment,
  Tag,
  TagConditionParser,
  TimeFragment,
  Word,
  type AlignmentConfig,
  type SvgFilterDefinitions,
} from '@tscaps/engine';
import { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { EditorStoreSegmentVisibilitySettings } from '@core/editor/services/EditorStoreSegmentVisibilitySettings';
import { SegmentVisibilityResolver } from '@core/editor/services/SegmentVisibilityResolver';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { DecorationTimeResolver } from '@core/effect/services/DecorationTimeResolver';
import { EffectRegistry } from '@core/effect/services/EffectRegistry';
import { InlineEmojiPunctuationAbsorber } from '@core/effect/services/InlineEmojiPunctuationAbsorber';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import { LineSplitterRegistry } from '@core/line-splitter/services/LineSplitterRegistry';
import { SegmentSplitterRegistry } from '@core/segment-splitter/services/SegmentSplitterRegistry';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import { Template } from '@core/templates/domain/Template';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';

/** What a test template differs in; everything else is plain. */
export interface TestTemplateOptions {
  readonly id: string;
  readonly css?: string;
  readonly styleControls?: ReadonlyArray<ControlField>;
  /** Whether the template puts captions behind the person on its own. */
  readonly behindActorRequired?: boolean;
  /** How its captions break into lines when laid out again; none of the line-splitting kinds when left out (laying out again then fails). */
  readonly lineSplitter?: LineSplitterConfig;
  /** The effects its sheets start with; none when left out. */
  readonly effects?: ReadonlyArray<EffectConfig>;
  /** Whether a scene or a line of it may be animated. Words and emojis always may. */
  readonly animatesScenes?: boolean;
  /** Whether it paints the video inside its captions. */
  readonly paintsVideoInside?: boolean;
  /** Whether its captions keep the vertical anchor of its alignment (their bottom edge) wherever they are moved. */
  readonly holdsVerticalAnchor?: boolean;
  /** The animations its stylesheet applies; none when left out. */
  readonly declaredAnimations?: ReadonlyArray<DeclaredAnimation>;
}

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'center', horizontalOffset: 0 };
const NO_LINE_SPLITTER = { mode: 'none' } as unknown as LineSplitterConfig;
const VIDEO_DURATION_SEC = 10;

/**
 * A small captioned project for running editor operations against real
 * actions. The captions of each sheet are fixed: the first sheet holds
 * "Hello world" (`s1`: `w1`, `w2`, with 🔥 riding `w2` as `w2:d`) and
 * "Again here" (`s2`: `w3` tagged emphasis and peak, `w4`), each scene
 * on a line of its own (`l1`, `l2`); a second sheet holds "Bye" (`s3`:
 * `w5`).
 */
export class CaptionOperationsTestProject {
  template(options: TestTemplateOptions): Template {
    const animatesScenes = options.animatesScenes ?? true;
    return new Template(
      { id: options.id, name: options.id, category: 'lab', unsupportedBrowsers: [] } as unknown as TemplateMetadata,
      TYPOGRAPHY_DEFAULTS,
      ROTATION_DEFAULTS,
      ALIGNMENT,
      { videoFrame: { required: options.paintsVideoInside ?? false } } as unknown as RenderingConfig,
      {
        animation: { segment: animatesScenes, line: animatesScenes, word: true, decoration: true },
        anchor: { vertical: !(options.holdsVerticalAnchor ?? false) },
        behindActorOverride: true,
      } as unknown as FeaturesConfig,
      { required: options.behindActorRequired ?? false, tagCondition: null },
      [...(options.effects ?? [])],
      [],
      options.lineSplitter ?? NO_LINE_SPLITTER,
      [...(options.styleControls ?? [])],
      [],
      {} as SvgFilterDefinitions,
      options.css ?? '',
      '',
      [...(options.declaredAnimations ?? [])],
    );
  }

  sheet(id: string, template: Template): Sheet {
    return Sheet.fromTemplate(id, id, null, template, 'ltr');
  }

  /** A project showing `sheets`, the first one active, with the captions described above. */
  store(sheets: ReadonlyArray<Sheet>): EditorStore {
    const store = new EditorStore();
    store.patch({
      document: this.document(sheets.map((sheet) => sheet.id)),
      sheets: [...sheets],
      activeSheetId: sheets[0]?.id ?? null,
      video: { duration: VIDEO_DURATION_SEC, isReady: true },
    });
    return store;
  }

  /** A deriver with no splitters, effects or taggers, deciding which scenes show from `store`. */
  deriverFor(store: EditorStore): DocumentDeriver {
    return new DocumentDeriver(
      [],
      new SegmentSplitterRegistry(new TagConditionParser()),
      new LineSplitterRegistry(new TagConditionParser()),
      new EffectRegistry(),
      { build: () => ({}) } as unknown as SheetCssVarsBuilder,
      new DecorationTimeResolver(),
      new InlineEmojiPunctuationAbsorber(),
      new SegmentVisibilityResolver(new EditorStoreSegmentVisibilitySettings(store)),
    );
  }

  /** A refresh that leaves the captions as they are, for actions that ask for one. */
  inertRefresh(): RefreshDocumentAction {
    return { execute: () => {} } as unknown as RefreshDocumentAction;
  }

  private document(sheetIds: ReadonlyArray<string>): Document {
    const [first, second] = sheetIds;
    const sections = [
      new Section({
        kind: first ?? 'main',
        segments: [
          this.scene('s1', 'l1', [
            new Word({ id: 'w1', text: 'Hello', time: new TimeFragment(0, 0.5) }),
            new Word({ id: 'w2', text: 'world', time: new TimeFragment(0.5, 1), decoration: new Decoration({ id: 'w2:d', glyph: '🔥' }) }),
          ]),
          this.scene('s2', 'l2', [
            new Word({ id: 'w3', text: 'Again', time: new TimeFragment(2, 2.5), semanticTags: new Set([Tag.of('emphasis'), Tag.of('peak')]) }),
            new Word({ id: 'w4', text: 'here', time: new TimeFragment(2.5, 3) }),
          ]),
        ],
      }),
    ];
    if (second !== undefined) {
      sections.push(new Section({
        kind: second,
        segments: [this.scene('s3', 'l3', [new Word({ id: 'w5', text: 'Bye', time: new TimeFragment(5, 5.5) })])],
      }));
    }
    return new Document({ sections });
  }

  private scene(id: string, lineId: string, words: ReadonlyArray<Word>): Segment {
    return new Segment({ id, lines: [new Line({ id: lineId, words: [...words] })] });
  }
}
