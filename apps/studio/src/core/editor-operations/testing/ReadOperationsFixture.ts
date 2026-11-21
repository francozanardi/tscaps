import { ElementCssReads } from '@core/editor-operations/services/ElementCssReads';
import { CaptionLineReadout } from '@core/editor-operations/services/CaptionLineReadout';
import { CaptionMarks } from '@core/editor-operations/services/CaptionMarks';
import { CaptionRowReadout } from '@core/editor-operations/services/CaptionRowReadout';
import { TranscriptTextReadout } from '@core/editor-operations/services/TranscriptTextReadout';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';
import { Decoration, Document, Line, Section, Segment, Tag, TimeFragment, Word } from '@tscaps/engine';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import { Template } from '@core/templates/domain/Template';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';
import { AnimationPresetReadout } from '@core/editor-operations/services/AnimationPresetReadout';
import { CaptionElementReadout } from '@core/editor-operations/services/CaptionElementReadout';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import { GraphicReadout } from '@core/editor-operations/services/GraphicReadout';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { SheetReadout } from '@core/editor-operations/services/SheetReadout';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { ShotLayerReadout } from '@core/editor-operations/services/ShotLayerReadout';
import { ShotReadout } from '@core/editor-operations/services/ShotReadout';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SoundClipReadout } from '@core/editor-operations/services/SoundClipReadout';
import { GetElementOperation } from '@core/editor-operations/services/descriptors/GetElementOperation';
import { GetProjectOperation } from '@core/editor-operations/services/descriptors/GetProjectOperation';
import { GetTranscriptOperation } from '@core/editor-operations/services/descriptors/GetTranscriptOperation';
import { ListCatalogOperation } from '@core/editor-operations/services/descriptors/ListCatalogOperation';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';

const ALIGNMENT: AlignmentConfig = { verticalAlign: 'bottom', verticalOffset: 0.12, horizontalAlign: 'center', horizontalOffset: 0.5 };
const TEXT_COLOR: ControlField = { id: 'text-color', label: 'Text', type: 'color', default: '#ffffff' };
// Long enough that a read describes it rather than repeating it.
const INLINE_PICTURE = `data:image/png;base64,${'A'.repeat(4000)}`;

/**
 * A project to read, wired the way the app wires the read operations,
 * with real collaborators and nothing of the app around them.
 *
 * Twelve seconds of 1920×1080 video exported 9:16, the playhead at 3 s.
 * Two sheets: `main` (template `ada`, its second preset, active) holds
 * `s1` ("Hello world", 0–1 s: `w1` tagged emphasis, said by speaker A,
 * styled with an inline picture; `w2` carrying the emoji `w2:d`) and
 * `s2` ("second line", 2–3 s, with its own pop-in); `second` holds `s3`
 * ("Bye now", 10–11 s), which the one cut, 10–11 s, takes away whole.
 * Two shots, edited: `a` from 0 s, and `b` from 6 s, coming in with a
 * flash, punching in, holding the b-roll `broll` (the file `clip`,
 * `broll.mp4`, from 1 s in) and the speaker card `card`. A whoosh,
 * `c1`, starts on `w3`. The picture is graded 0.2 more saturated.
 */
export class ReadOperationsFixture {
  readonly store = new EditorStore();
  readonly media = new MediaAssetStore();
  readonly graphicMessages = new GraphicMessageLog();
  readonly userTemplates = new UserTemplatesStore([]);
  readonly template: Template;

  private readonly parser = new EditorRefParser();
  private readonly format = new ReadoutFormatter();
  private readonly graphicPresets = new BuiltinGraphicPresetCatalog();
  private readonly originalCaptions = new OriginalCaptionTrackReader();
  private readonly styles = new ElementStyleReadout(this.format);
  private readonly shownDecorations = new ShownDecorationReader(new DecorationFilter(new DecorationVisibility()));
  private readonly graphics = new GraphicReadout(this.graphicPresets, this.graphicMessages, this.format);
  private readonly layers = new ShotLayerReadout(
    this.media,
    new ShotLayerAssetReader(),
    this.graphics,
    this.styles,
    new ShotLayerSplitTransitions(),
    new ShotLayerInsetTransitions(),
    this.parser,
    this.format,
  );
  private readonly sounds = new SoundClipReadout(
    new AudioAnchorTiming(
      new ShotLayerTiming(new ShotLayerAssetReader()),
      new ShotLayerSplitTransitions(),
      new ShotLayerInsetTransitions(),
      new ShotTransitionCuts(),
      new DecorationFilter(new DecorationVisibility()),
    ),
    this.media,
    new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'),
    this.originalCaptions,
    this.parser,
    this.format,
  );
  private readonly shotRefs = new ShotRefResolver(
    this.store,
    new ShotPartitionMaterializer(new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()), this.originalCaptions),
    this.parser,
  );
  private readonly shotReadout = new ShotReadout(this.layers, this.styles, this.format);

  constructor() {
    this.template = this.buildTemplate();
    this.media.put({
      id: 'clip',
      type: 'video',
      owner: { kind: 'library' },
      fileName: 'broll.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1,
      widthPx: 1920,
      heightPx: 1080,
      durationSec: 5,
    });
    this.store.patch({
      availableTemplates: [this.template],
      sheets: [this.sheet('main', 'Main', 1), this.sheet('second', 'Second', 0)],
      activeSheetId: 'main',
      document: this.buildDocument(),
      elementStyles: this.buildElementStyles(),
      shots: this.buildShots(),
      cuts: CutRegistry.fromSnapshot([{ startSec: 10, endSec: 11 }]),
      audio: this.buildAudio(),
      colorGrade: ColorGrade.fromSnapshot({ saturation: 0.2 }),
      outputFrame: OutputFrame.original().withFormat('9:16'),
      video: { duration: 12, layout: { width: 1920, height: 1080 }, currentTime: 3 },
    });
  }

  getProject(): GetProjectOperation {
    return new GetProjectOperation(this.store, this.shotRefs, this.shotReadout, this.sounds, this.originalCaptions, this.parser, this.format);
  }

  getTranscript(): GetTranscriptOperation {
    const marks = new CaptionMarks();
    return new GetTranscriptOperation(
      this.store,
      this.format,
      this.shownDecorations,
      new TranscriptTextReadout(this.format),
      new CaptionLineReadout(this.parser, this.format, marks),
      new CaptionRowReadout(this.parser, this.format, marks),
    );
  }

  getElement(): GetElementOperation {
    return new GetElementOperation(
      this.store,
      this.parser,
      new CaptionRefResolver(this.store, this.parser),
      this.shotRefs,
      new SheetRefResolver(this.store, this.parser),
      new CaptionElementReadout(this.parser, this.styles, this.format, this.shownDecorations),
      this.layers,
      this.shotReadout,
      new SheetReadout(this.parser, this.styles, this.format),
      this.sounds,
      new ElementCssReads(this.store),
    );
  }

  listCatalog(): ListCatalogOperation {
    return new ListCatalogOperation(
      this.store,
      this.userTemplates,
      { ada: { config: { description: 'Bold words in a light pill.' } } },
      new AnimationPresetReadout(
        new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS),
        new TestShotLayerLayouts().catalog,
        new ElementTimingVariableResolver(),
        this.format,
      ),
      this.graphicPresets,
      this.graphics,
      new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/'),
      this.media,
      new ColorGradeLooks(),
      this.format,
    );
  }

  /** A plain template under `id`, built as the fixture's own is. */
  templateNamed(id: string): Template {
    return this.buildTemplate(id);
  }

  private buildTemplate(id = 'ada'): Template {
    return new Template(
      { id, name: id, category: 'classic', unsupportedBrowsers: [] },
      TYPOGRAPHY_DEFAULTS,
      ROTATION_DEFAULTS,
      ALIGNMENT,
      {} as RenderingConfig,
      {} as FeaturesConfig,
      BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT,
      [],
      [],
      { mode: 'none' } as unknown as LineSplitterConfig,
      [TEXT_COLOR],
      [{ label: 'Light', overrides: {} }, { label: 'Dark', overrides: { 'text-color': '#111111' } }],
      {} as SvgFilterDefinitions,
      '.segment { color: var(--text-color); }',
      '',
      [],
    );
  }

  private sheet(id: string, name: string, variantIndex: number): Sheet {
    return new Sheet({
      id,
      name,
      color: null,
      template: this.template,
      variantIndex,
      styleValues: StyleValues.fromTemplateVariant(this.template, variantIndex),
      typographyConfig: TYPOGRAPHY_DEFAULTS,
      rotationConfig: ROTATION_DEFAULTS,
      segmentSplitterConfigs: [],
      lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
      alignmentConfig: ALIGNMENT,
      effectConfigs: [],
    });
  }

  private buildDocument(): Document {
    const hello = new Word({
      id: 'w1',
      text: 'Hello',
      time: new TimeFragment(0, 0.5),
      semanticTags: new Set([Tag.of('emphasis')]),
      speakerId: 'A',
    });
    const world = new Word({
      id: 'w2',
      text: 'world',
      time: new TimeFragment(0.5, 1),
      decoration: new Decoration({ id: 'w2:d', glyph: '🔥' }),
    });
    return new Document({
      language: 'en',
      sections: [
        new Section({
          kind: 'main',
          segments: [
            this.segment('s1', 'l1', [hello, world]),
            this.segment('s2', 'l2', [this.word('w3', 'second', 2, 2.5), this.word('w4', 'line', 2.5, 3)]),
          ],
        }),
        new Section({ kind: 'second', segments: [this.segment('s3', 'l3', [this.word('w5', 'Bye', 10, 10.5), this.word('w6', 'now', 10.5, 11)])] }),
      ],
    });
  }

  private segment(id: string, lineId: string, words: ReadonlyArray<Word>): Segment {
    return new Segment({ id, lines: [new Line({ id: lineId, words })] });
  }

  private word(id: string, text: string, startSec: number, endSec: number): Word {
    return new Word({ id, text, time: new TimeFragment(startSec, endSec) });
  }

  private buildElementStyles(): ElementStyles {
    return ElementStyles.fromSnapshot({
      w1: { kind: 'word', fields: { 'font-size': 1.2 }, css: `color: red; background: url(${INLINE_PICTURE});` },
      s2: { kind: 'segment', animations: { self: { presetId: 'pop-in', params: { duration: 0.5 } } }, css: '.x { opacity: 1; }' },
    });
  }

  private buildShots(): ShotPartition {
    const card = this.graphicPresets.starter().graphic;
    return ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'a', startSec: 0 },
        {
          id: 'b',
          startSec: 6,
          transition: { kind: 'flash', durationSec: 0.4 },
          layers: [
            { id: 'broll', mediaId: 'clip', inSec: 1, outSec: null, loop: false },
            { id: 'card', graphic: { ...card, params: { title: 'Ada Lovelace' } } },
          ],
        },
      ],
      layerStyles: {
        'shot-video-b': { kind: 'layer', animations: { camera: { presetId: 'layer-punch-in-camera', params: {} } }, css: '' },
      },
    });
  }

  private buildAudio(): AudioMix {
    return AudioMix.fromSnapshot({
      sourceVolume: 1,
      clips: [{
        id: 'c1',
        role: 'effect',
        source: { kind: 'builtin', soundId: 'whoosh-soft' },
        start: { anchor: { kind: 'word', wordId: 'w3', edge: 'start' }, offsetSec: 0 },
        end: null,
        inSec: 0,
        loop: false,
        volume: 0.8,
        fadeInSec: 0,
        fadeOutSec: 0,
        ducking: { enabled: false, depthDb: -12 },
      }],
    });
  }
}
