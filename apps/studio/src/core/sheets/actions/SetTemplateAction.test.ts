import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';
import { CaptionModeAssigner } from '@core/caption-modes/services/CaptionModeAssigner';
import { AssignCaptionModesAction } from '@core/caption-modes/actions/AssignCaptionModesAction';
import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, SvgFilterDefinitionsParser, Tag, TagConditionParser, TimeFragment, Word, type AlignmentConfig, type SvgFilterDefinitions } from '@tscaps/engine';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { DocumentSheetElementResolver } from '@core/captions/services/DocumentSheetElementResolver';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import type { RecordTemplateUseAction } from '@core/templates/actions/RecordTemplateUseAction';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { Template } from '@core/templates/domain/Template';
import { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import { TemplateSoundPlacer } from '@core/sheets/services/TemplateSoundPlacer';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { TemplateSound } from '@core/templates/domain/definition/TemplateSound';
import { BODY_ONLY_MODES, type TemplateModes } from '@core/templates/domain/definition/TemplateMode';
import type { ModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';
import { TemplateFromSheetBuilder } from '@core/user-templates/services/TemplateFromSheetBuilder';
import type { ControlValue } from '@core/templates/domain/definition/ControlField';

/**
 * Trying out a template, from a project whose sheets stand for speakers.
 *
 * Each speaker sheet is pinned to a different preset, and most templates
 * ship no presets at all. So the pick that shows every speaker the same
 * look has to be a view of the moment, not a decision written down: the
 * speakers were told apart before it and are told apart again after it.
 */

const TEXT_COLOR: ControlField = {
  id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff', group: 'style', subgroup: 'colors',
};

const CONTROLS = [TEXT_COLOR];

const THREE_PRESETS: StyleVariants = [
  { label: 'A', overrides: { 'primary-color': '#aaaaaa' } },
  { label: 'B', overrides: { 'primary-color': '#bbbbbb' } },
  { label: 'C', overrides: { 'primary-color': '#cccccc' } },
];

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

const NO_LINE_SPLITTER = { mode: 'none' } as unknown as LineSplitterConfig;

function templateShipping(id: string, variants: StyleVariants, lineSplitter: LineSplitterConfig = NO_LINE_SPLITTER): Template {
  return new Template(
    { id, category: 'lab' } as unknown as TemplateMetadata,
    TYPOGRAPHY_DEFAULTS,
    ROTATION_DEFAULTS,
    ALIGNMENT,
    {} as RenderingConfig,
    {} as FeaturesConfig,
    {} as BehindActorTemplateConfig,
    [],
    [],
    lineSplitter,
    CONTROLS,
    variants,
    {} as SvgFilterDefinitions,
    '',
    '',
    [],
  );
}

const withPresets = templateShipping('with-presets', THREE_PRESETS);
const withoutPresets = templateShipping('without-presets', []);
const twoLinesAtMost = templateShipping(
  'two-lines-at-most',
  [],
  { type: 'balanced-pixel-width', maxLines: 2 } as unknown as LineSplitterConfig,
);

function speakerSheet(id: string, template: Template, variantIndex: number, linkGroupId: string | null = 'speakers'): Sheet {
  return new Sheet({
    id,
    name: id,
    color: null,
    template,
    variantIndex,
    styleValues: StyleValues.fromTemplateVariant(template, variantIndex),
    typographyConfig: TYPOGRAPHY_DEFAULTS,
    rotationConfig: ROTATION_DEFAULTS,
    segmentSplitterConfigs: [],
    lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
    alignmentConfig: ALIGNMENT,
    effectConfigs: [],
    linkGroupId,
  });
}

/** Three linked speaker sheets, each on its own preset of the same template. */
function storeShowingThreeSpeakers(): EditorStore {
  const store = new EditorStore();
  store.patch({
    sheets: [
      speakerSheet('main', withPresets, 0),
      speakerSheet('speaker-2', withPresets, 1),
      speakerSheet('speaker-3', withPresets, 2),
    ],
    activeSheetId: 'main',
  });
  return store;
}

const noElementsResolver: SheetElementResolver = { elementsOf: () => new Set() };

function actionOn(store: EditorStore, elements: SheetElementResolver = noElementsResolver): SetTemplateAction {
  return new SetTemplateAction(
    store,
    { execute: () => {} } as unknown as RefreshDocumentAction,
    { execute: () => {} } as unknown as RecordTemplateUseAction,
    { capture: () => {} } as unknown as Telemetry,
    new LinkedSheetsSync(new LinkedSheetsPropagationNotifier()),
    elements,
    new TemplateSoundPlacer(new AudioClipDefaults(), new TagConditionParser()),
    new AssignCaptionModesAction(new CaptionModeAssigner(new ModeMatcherRegistry(new TagConditionParser()))),
  );
}

function textColors(store: EditorStore): (ControlValue | null)[] {
  return store.snapshot().sheets.map((sheet) => sheet.styleValues.values['primary-color'] ?? null);
}

describe('picking a template for a group of speaker sheets', () => {
  it('shows every speaker the same look while the template has no presets', () => {
    const store = storeShowingThreeSpeakers();

    actionOn(store).execute(withoutPresets);

    expect(textColors(store)).toEqual(['#ffffff', '#ffffff', '#ffffff']);
  });

  it('gives each speaker its own preset back on a template that has them', () => {
    const store = storeShowingThreeSpeakers();
    const action = actionOn(store);

    action.execute(withoutPresets);
    action.execute(withPresets);

    expect(textColors(store)).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc']);
  });

  it('keeps a speaker past the last preset apart from the first once presets are plentiful', () => {
    const store = new EditorStore();
    store.patch({
      sheets: [speakerSheet('main', withoutPresets, 0), speakerSheet('speaker-4', withoutPresets, 3)],
      activeSheetId: 'main',
    });

    actionOn(store).execute(templateShipping('four-presets', [
      ...THREE_PRESETS,
      { label: 'D', overrides: { 'primary-color': '#dddddd' } },
    ]));

    expect(textColors(store)).toEqual(['#aaaaaa', '#dddddd']);
  });
});

/**
 * A scene the user split, merged, inserted, retyped or timed by hand is
 * frozen: the splitters pass it through as it is. That shape was drawn
 * against the rules of the template it was drawn on, and most templates
 * cut captions into scenes and lines their own way, so a scene held to
 * the old shape reads like neither.
 */
describe('picking a template for a sheet holding scenes shaped by hand', () => {
  /** One scene per sheet, its single word named after the sheet. */
  function documentWithOneSceneOn(...sheetIds: ReadonlyArray<string>): Document {
    return new Document({
      sections: sheetIds.map((sheetId, index) => new Section({
        kind: sheetId,
        segments: [new Segment({
          id: `scene-of-${sheetId}`,
          lines: [new Line({ words: [new Word({ id: `word-of-${sheetId}`, text: sheetId, time: new TimeFragment(index, index + 1) })] })],
        })],
      })),
    });
  }

  function storeWith(sheets: ReadonlyArray<Sheet>, shapedByHand: ReadonlyArray<string>): EditorStore {
    const store = new EditorStore();
    store.patch({
      sheets: [...sheets],
      activeSheetId: 'main',
      document: documentWithOneSceneOn(...sheets.map((sheet) => sheet.id)),
      frozenSegments: FrozenSegmentSet.empty().withStructurallyEdited(shapedByHand),
    });
    return store;
  }

  function pickOn(store: EditorStore, template: Template): void {
    actionOn(store, new DocumentSheetElementResolver(store)).execute(template);
  }

  function frozen(store: EditorStore): string[] {
    const set = store.snapshot().frozenSegments;
    return (store.snapshot().document?.getSegments() ?? []).map((segment) => segment.id).filter((id) => set.has(id));
  }

  it('lets a template that cuts captions its own way lay the sheet\'s scenes out again', () => {
    const store = storeWith([speakerSheet('main', withPresets, 0, null)], ['scene-of-main']);

    pickOn(store, twoLinesAtMost);

    expect(frozen(store)).toEqual([]);
  });

  it('keeps the shapes when the sheet is saved as a template of its own, which cuts captions as it did', () => {
    const sheet = speakerSheet('main', twoLinesAtMost, 0, null);
    const store = storeWith([sheet], ['scene-of-main']);
    const saved = new TemplateFromSheetBuilder(new SvgFilterDefinitionsParser()).build(sheet, { id: 'mine', name: 'Mine' });

    pickOn(store, saved);

    expect(frozen(store)).toEqual(['scene-of-main']);
  });

  it('leaves a scene on a sheet the pick does not reach as it was shaped', () => {
    const store = storeWith(
      [speakerSheet('main', withPresets, 0, null), speakerSheet('titles', withPresets, 0, null)],
      ['scene-of-main', 'scene-of-titles'],
    );

    pickOn(store, twoLinesAtMost);

    expect(frozen(store)).toEqual(['scene-of-titles']);
  });

  it('lets every sheet linked to the one picked for lay its scenes out again', () => {
    const store = storeWith(
      [speakerSheet('main', withPresets, 0), speakerSheet('speaker-2', withPresets, 1)],
      ['scene-of-main', 'scene-of-speaker-2'],
    );

    pickOn(store, twoLinesAtMost);

    expect(frozen(store)).toEqual([]);
  });

  it('gives the shape back with the template in one undo', () => {
    const store = storeWith([speakerSheet('main', withPresets, 0, null)], ['scene-of-main']);

    pickOn(store, twoLinesAtMost);
    store.undo();

    expect(frozen(store)).toEqual(['scene-of-main']);
    expect(store.snapshot().sheets[0]!.template).toBe(withPresets);
  });
});

describe('picking a template that plays sounds on its words', () => {
  const peakClick: TemplateSound = { when: 'peak or hook', alone: false, soundId: 'click-mouse', volume: 0.3, offsetSec: 0, minGapSec: 0 };
  const loneWordPop: TemplateSound = { when: 'emphasis', alone: true, soundId: 'pop-punchy', volume: 0.5, offsetSec: -0.05, minGapSec: 0 };

  function templatePlaying(id: string, sounds: readonly TemplateSound[]): Template {
    const base = templateShipping(id, []);
    return new Template(
      base.metadata, base.typography, base.rotation, base.alignment, base.rendering, base.features, base.behindActor,
      base.effectConfigs, base.segmentSplitterConfigs, base.lineSplitter, base.styleControls, base.variants,
      base.svgFilterDefinitions, base.getCss(), base.getFiltersSvg(), base.declaredAnimations, base.fontStackIds, null, sounds,
    );
  }

  const posterSounds = templatePlaying('poster', [peakClick, loneWordPop]);
  const silent = templatePlaying('silent', []);

  /** Each caption a list of words; a word written `text:tag` carries that tag. */
  function documentOf(captions: ReadonlyArray<ReadonlyArray<string>>): Document {
    return new Document({
      sections: [new Section({
        kind: 'main',
        segments: captions.map((words, captionIndex) => new Segment({
          id: `caption-${captionIndex}`,
          lines: [new Line({ words: words.map((token, wordIndex) => {
            const [text, tag] = token.split(':');
            return new Word({
              id: text!,
              text: text!,
              time: new TimeFragment(captionIndex * 10 + wordIndex, captionIndex * 10 + wordIndex + 1),
              semanticTags: tag ? new Set([Tag.of(tag)]) : new Set<Tag>(),
            });
          }) })],
        })),
      })],
    });
  }

  function storeOn(template: Template, captions: ReadonlyArray<ReadonlyArray<string>>): EditorStore {
    const store = new EditorStore();
    store.patch({ sheets: [speakerSheet('main', template, 0, null)], activeSheetId: 'main', document: documentOf(captions) });
    return store;
  }

  function soundsOn(store: EditorStore): string[] {
    return store.snapshot().audio.clips().map((clip) => {
      const anchor = clip.start.anchor;
      const soundId = clip.source.kind === 'builtin' ? clip.source.soundId : '?';
      return `${anchor.kind === 'word' ? anchor.wordId : anchor.kind} ${soundId}`;
    });
  }

  it('places its sound on every word its expression holds for, at the word\'s start', () => {
    const store = storeOn(silent, [['so', 'here'], ['it:peak', 'matters:peak'], ['done']]);

    actionOn(store).execute(posterSounds);

    expect(soundsOn(store)).toEqual(['it click-mouse', 'matters click-mouse']);
    const clip = store.snapshot().audio.clips()[0]!;
    expect(clip.start).toEqual({ anchor: { kind: 'word', wordId: 'it', edge: 'start' }, offsetSec: 0 });
    expect(clip.volume).toBe(0.3);
    expect(clip.role).toBe('effect');
  });

  it('plays a sound kept for a word alone in its caption only on such a word', () => {
    const store = storeOn(silent, [['really:emphasis'], ['a', 'big:emphasis', 'deal']]);

    actionOn(store).execute(posterSounds);

    expect(soundsOn(store)).toEqual(['really pop-punchy']);
  });

  it('takes its sounds away when another template replaces it, and leaves the person\'s own', () => {
    const store = storeOn(silent, [['it:peak', 'matters:peak']]);
    actionOn(store).execute(posterSounds);
    store.patch({ audio: store.snapshot().audio.withClipAdded(new AudioClipDefaults().clipFrom('mine', {
      role: 'effect', source: { kind: 'builtin', soundId: 'ding-bell' }, start: { anchor: { kind: 'word', wordId: 'it', edge: 'start' }, offsetSec: 0 },
    })) });

    actionOn(store).execute(silent);

    expect(soundsOn(store)).toEqual(['it ding-bell']);
  });

  it('places nothing while a translation is the active track', () => {
    const store = storeOn(silent, [['it:peak']]);
    store.patch({ activeCaptionTrackId: 'translation-es' });

    actionOn(store).execute(posterSounds);

    expect(soundsOn(store)).toEqual([]);
  });

  it('takes the sounds back with the template in one undo', () => {
    const store = storeOn(silent, [['it:peak']]);

    actionOn(store).execute(posterSounds);
    store.undo();

    expect(soundsOn(store)).toEqual([]);
    expect(store.snapshot().sheets[0]!.template).toBe(silent);
  });
});

describe('picking a template that designs a mode beyond its body', () => {
  const tap: TemplateSound = { when: 'spotlight', alone: false, soundId: 'tap', volume: 0.2, offsetSec: 0, minGapSec: 0 };

  function templateWithModes(id: string, modes: TemplateModes, sounds: readonly TemplateSound[]): Template {
    const base = templateShipping(id, []);
    return new Template(
      base.metadata, base.typography, base.rotation, base.alignment, base.rendering, base.features, base.behindActor,
      base.effectConfigs, base.segmentSplitterConfigs, base.lineSplitter, base.styleControls, base.variants,
      base.svgFilterDefinitions, base.getCss(), base.getFiltersSvg(), base.declaredAnimations, base.fontStackIds, null, sounds, modes,
    );
  }

  const keyPhrases = templateWithModes('key-phrases', {
    base: { label: 'Captions', legend: null },
    extra: [{
      tag: 'spotlight',
      label: 'Key phrases',
      legend: null,
      matchers: [{ type: 'tag-condition', condition: 'hook or peak' } as ModeMatcherConfig],
      segmentSplitterConfigs: [],
      lineSplitter: NO_LINE_SPLITTER,
    }],
  }, [tap]);
  const plain = templateWithModes('plain', BODY_ONLY_MODES, []);

  /** Each word written `text:tag` carries that tag. */
  function storeOn(template: Template, tokens: ReadonlyArray<string>): EditorStore {
    const store = new EditorStore();
    const words = tokens.map((token, i) => {
      const [text, tag] = token.split(':');
      return new Word({ id: text!, text: text!, time: new TimeFragment(i, i + 1), semanticTags: tag ? new Set([Tag.of(tag)]) : new Set<Tag>() });
    });
    store.patch({
      sheets: [speakerSheet('main', template, 0, null)],
      activeSheetId: 'main',
      document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words })] })] })] }),
    });
    return store;
  }

  function spotlit(store: EditorStore): string[] {
    return store.snapshot().document!.getWords().filter((word) => word.hasTagName('spotlight')).map((word) => word.text);
  }

  function soundIdsOn(store: EditorStore): string[] {
    return store.snapshot().audio.clips().map((clip) => (clip.source.kind === 'builtin' ? clip.source.soundId : '?'));
  }

  it('puts the words its matchers pick into the mode, and plays the mode\'s sound on each', () => {
    const store = storeOn(plain, ['so', 'this:hook', 'matters:peak', 'now']);

    actionOn(store).execute(keyPhrases);

    expect(spotlit(store)).toEqual(['this', 'matters']);
    expect(soundIdsOn(store)).toEqual(['tap', 'tap']);
  });

  it('passes over a word said too soon after the last one that got the sound', () => {
    const spaced = templateWithModes('spaced', keyPhrases.modes, [{ ...tap, minGapSec: 1.5 }]);
    const store = storeOn(plain, ['one:peak', 'two:peak', 'three:peak', 'four:peak']);

    actionOn(store).execute(spaced);

    // Words start a second apart: the second and the fourth come too soon.
    expect(store.snapshot().audio.clips().map((clip) => (clip.start.anchor.kind === 'word' ? clip.start.anchor.wordId : ''))).toEqual(['one', 'three']);
  });

  it('takes the mode\'s tag off every word when the next template designs no such mode, the person\'s own included', () => {
    const store = storeOn(keyPhrases, ['so', 'this:spotlight', 'matters:peak']);

    actionOn(store).execute(plain);

    expect(spotlit(store)).toEqual([]);
  });
});
