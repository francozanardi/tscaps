import { z } from 'zod';
import type { BuiltinSound } from '@core/audio-mix/domain/BuiltinSound';
import { BUILTIN_SOUND_CATEGORIES } from '@core/audio-mix/domain/BuiltinSoundCategory';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import {
  SHOT_TRANSITION_KINDS,
  SHOT_TRANSITION_RECOMMENDED_DURATION_SEC,
} from '@core/shots/domain/ShotTransition';
import { ShotTransitionSanitizer } from '@core/shots/domain/ShotTransitionSanitizer';
import { TAG_METADATA, WORD_TAG_NAMES } from '@core/tagging/domain/TagName';
import type { Template } from '@core/templates/domain/Template';
import type { UserTemplatesStore } from '@core/user-templates/store/UserTemplatesStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { AnimationPresetReadout } from '@core/editor-operations/services/AnimationPresetReadout';
import type { GraphicReadout } from '@core/editor-operations/services/GraphicReadout';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { RECOMMENDED_TEMPLATES } from '@core/editor-operations/services/RecommendedTemplates';

/** The catalogs a caller can list, in the order they are offered. */
const CATALOGS = [
  'templates',
  'all_templates',
  'caption_animations',
  'layer_motions',
  'camera_moves',
  'transitions',
  'graphic_presets',
  'sounds',
  'media',
  'looks',
  'word_tags',
] as const;

type CatalogName = typeof CATALOGS[number];

/**
 * What the built-in templates' own files say about them, by template id.
 * Only the description each one's author wrote is read: what the
 * captions look like and what they suit.
 */
export type BuiltinTemplateConfigs = Readonly<Record<string, { readonly config: { readonly description?: string | undefined } }>>;

// Said with the list, where the model is choosing: the presets' looks suit their own purpose, not a key moment.
const GRAPHIC_PRESETS_USE = 'Each preset is for what its family says (a hook, by the hooks guide; a speaker; a call to action; the info family when the person asks for that kind of graphic: a number, a phrase, a contrast, a list item, a section title, a quote, a place). For a key moment of the video (the number, the word, the line that matters), write your own in the graphics guide\'s editorial look instead (read_guide graphics): type only on the picture, no plate or card, beside the face.';

/**
 * `list_catalog`: one of the catalogs of what the editor offers, as
 * compact rows whose ids the editing operations take. Reads only.
 */
export class ListCatalogOperation implements EditorOperation {
  readonly name = 'list_catalog';
  readonly effect = 'read';
  readonly description = [
    'List one catalog of what the editor offers, to pick valid ids before an edit.',
    'templates: the recommended caption templates in full (when each suits, family, description, presets, font), the others by id, and the ones the person saved; all_templates: every template in full, for a look the recommended ones do not have; caption_animations: animation presets for caption segments, lines, words and emojis, and which scopes take them; layer_motions: how a layer enters and leaves; camera_moves: camera moves for a shot\'s video or a layer; transitions: shot transition kinds and their durations;',
    `graphic_presets: graphics to start a graphic layer from, one row each (family, what it is for, hidesCaptions when it keeps the captions off its shot, and its fields as {id: kind}, the ids add_graphic params takes); with \`ids\`, those presets in full instead: each field's label and default, the box and the aspect ratio; sounds: bundled sound effects, each with its category, length and what it sounds like and suits, only those of one \`category\` when given (${BUILTIN_SOUND_CATEGORIES.join(', ')}); with \`ids\`, those sounds in full, with the volume that sits each under a voice (underVoice), which add_sounds already applies by default; media: the files of this project's media bin (video, picture, gif, audio) with their ids; looks: colour grade looks; word_tags: the tags a word can be given.`,
    'A param is described by its range, unit and default. Durations are in seconds.',
  ].join(' ');

  private readonly input = new OperationInput({
    catalog: z.enum(CATALOGS).describe('Which catalog to list.'),
    ids: z.array(z.string()).min(1).optional().describe('graphic_presets or sounds only: the ids of the presets or sounds to read in full.'),
    category: z.string().optional().describe('sounds only: list only the sounds of this category.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly userTemplates: UserTemplatesStore,
    private readonly builtinTemplateConfigs: BuiltinTemplateConfigs,
    private readonly animationPresets: AnimationPresetReadout,
    private readonly graphicPresets: GraphicPresetCatalog,
    private readonly graphics: GraphicReadout,
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly media: MediaAssetStore,
    private readonly looks: ColorGradeLooks,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { catalog, ids, category } = checked.value;
    if (ids !== undefined) return this.inFull(catalog, ids);
    if (category !== undefined) return this.soundsOf(catalog, category);
    return { ok: true, output: this.listed(catalog), problems: [] };
  }

  /** The rows `ids` names in full, for the catalogs whose list leaves details out. */
  private inFull(catalog: CatalogName, ids: ReadonlyArray<string>): OperationResult {
    if (catalog === 'graphic_presets') return this.presetsInFull(ids);
    if (catalog === 'sounds') return this.soundsInFull(ids);
    return this.refused([{ severity: 'error', message: `ids reads graphic presets or sounds in full; ${catalog} lists everything already.` }]);
  }

  /** The sounds of one category; refused for another catalog or a category no sound has. */
  private soundsOf(catalog: CatalogName, category: string): OperationResult {
    if (catalog !== 'sounds') return this.refused([{ severity: 'error', message: `category narrows sounds only; ${catalog} has no categories to narrow by.` }]);
    const sounds = this.builtinSounds.list();
    const categories: string[] = [...new Set(sounds.map((sound) => sound.category))];
    if (!categories.includes(category)) {
      return this.refused([{ severity: 'error', message: `No sound is in the category "${category}"; the categories are ${categories.join(', ')}.` }]);
    }
    return { ok: true, output: { sounds: sounds.filter((sound) => sound.category === category).map((sound) => this.soundRow(sound)) }, problems: [] };
  }

  /** The sounds `ids` names, in full; refused for an id no sound has. */
  private soundsInFull(ids: ReadonlyArray<string>): OperationResult {
    const known = this.builtinSounds.list();
    const unknown = ids.filter((id) => !known.some((sound) => sound.id === id));
    if (unknown.length > 0) {
      return this.refused([{ severity: 'error', message: `There is no bundled sound ${unknown.map((id) => `"${id}"`).join(', ')}; list_catalog sounds lists them.` }]);
    }
    const rows = ids.map((id) => known.find((sound) => sound.id === id)!).map((sound) => ({ ...this.soundRow(sound), underVoice: sound.underVoiceVolume }));
    return { ok: true, output: { sounds: rows }, problems: [] };
  }

  /** The graphic presets `ids` names, in full; refused for an id no preset has. */
  private presetsInFull(ids: ReadonlyArray<string>): OperationResult {
    const known = this.graphicPresets.list();
    const unknown = ids.filter((id) => !known.some((preset) => preset.id === id));
    if (unknown.length > 0) {
      return this.refused([{ severity: 'error', message: `There is no graphic preset ${unknown.map((id) => `"${id}"`).join(', ')}; the presets are ${known.map((preset) => preset.id).join(', ')}.` }]);
    }
    const rows = ids.map((id) => this.graphicPresetInFull(known.find((preset) => preset.id === id)!));
    return { ok: true, output: { presets: rows }, problems: [] };
  }

  private listed(catalog: CatalogName): unknown {
    switch (catalog) {
      case 'templates':
        return this.templates(false);
      case 'all_templates':
        return this.templates(true);
      case 'caption_animations':
        return this.animationPresets.captionAnimations();
      case 'layer_motions':
        return this.animationPresets.layerMotions();
      case 'camera_moves':
        return { moves: this.animationPresets.cameraMoves() };
      case 'transitions':
        return this.transitions();
      case 'graphic_presets':
        return { use: GRAPHIC_PRESETS_USE, presets: this.graphicPresetRows() };
      case 'sounds':
        return { sounds: this.soundRows() };
      case 'media':
        return { media: this.mediaRows() };
      case 'looks':
        return { looks: this.lookRows() };
      case 'word_tags':
        return this.wordTags();
    }
  }

  /**
   * The caption templates: the recommended ones in full, each with when it
   * suits, and the others by id and family alone, or in full when
   * `othersInFull`; and the ones the person saved.
   */
  private templates(othersInFull: boolean): Record<string, unknown> {
    const saved = this.userTemplates.snapshot().map((userTemplate) => ({
      id: userTemplate.template.metadata.id,
      name: userTemplate.template.metadata.name,
      ...(userTemplate.parentTemplateId === null ? {} : { basedOn: userTemplate.parentTemplateId }),
    }));
    const available = this.store.snapshot().availableTemplates;
    const recommended = RECOMMENDED_TEMPLATES.flatMap((pick) => {
      const template = available.find((each) => each.metadata.id === pick.id);
      return template === undefined ? [] : [{ id: pick.id, when: pick.when, ...this.templateRow(template) }];
    });
    const picked = new Set(RECOMMENDED_TEMPLATES.map((pick) => pick.id));
    const others = available.filter((template) => !picked.has(template.metadata.id));
    return {
      choose: othersInFull
        ? 'Prefer recommended; pick from others for a look the person asked for that none of them has.'
        : 'Pick from recommended. When the person names a style, a creator or a look ("Hormozi", "karaoke", "comic") that none of them describes, list all_templates first: the others\' descriptions name them.',
      recommended,
      others: others.map((template) => (othersInFull ? this.templateRow(template) : { id: template.metadata.id, family: template.metadata.category })),
      ...(saved.length === 0 ? {} : { saved }),
    };
  }

  private templateRow(template: Template): Record<string, unknown> {
    const { id, name, category } = template.metadata;
    const description = this.builtinTemplateConfigs[id]?.config.description?.trim() ?? '';
    return {
      id,
      ...(name === id ? {} : { name }),
      family: category,
      ...(description.length === 0 ? {} : { description }),
      ...(template.variants.length < 2 ? {} : { presets: template.variants.map((variant) => variant.label) }),
      font: template.typography.fontStack.familyFor('latin'),
      ...(template.behindActor.required ? { behindPerson: true } : {}),
    };
  }

  private transitions(): Record<string, unknown> {
    return {
      kinds: SHOT_TRANSITION_KINDS.map((kind) => ({ kind, defaultSec: SHOT_TRANSITION_RECOMMENDED_DURATION_SEC[kind] })),
      durationSec: { min: ShotTransitionSanitizer.MIN_DURATION_SEC, max: ShotTransitionSanitizer.MAX_DURATION_SEC },
      plays: 'over the whole frame at the cut into a shot, half before the cut and half after; the first shot has none',
    };
  }

  /**
   * One short row per graphic preset, enough to choose one and set its
   * fields: a preset's labels, defaults, box and aspect ratio are read in
   * full only for the ones chosen, since the list grows with every preset.
   */
  private graphicPresetRows(): Array<Record<string, unknown>> {
    return this.graphicPresets.list().map((preset) => ({
      id: preset.id,
      ...(preset.category === null ? {} : { family: preset.category }),
      ...(preset.description.length === 0 ? {} : { description: preset.description }),
      ...(preset.graphic.hidesCaptions ? { hidesCaptions: true } : {}),
      fields: Object.fromEntries(preset.graphic.fields.map((field) => [field.id, field.kind])),
    }));
  }

  private graphicPresetInFull(preset: GraphicPreset): Record<string, unknown> {
    return {
      id: preset.id,
      name: preset.name,
      ...(preset.category === null ? {} : { family: preset.category }),
      ...(preset.description.length === 0 ? {} : { description: preset.description }),
      ...(preset.graphic.hidesCaptions ? { hidesCaptions: true } : {}),
      aspectRatio: this.format.share(preset.graphic.aspectRatio),
      box: preset.box.kind === 'full'
        ? 'full'
        : { centerX: this.format.share(preset.box.centerX), centerY: this.format.share(preset.box.centerY), width: this.format.share(preset.box.width) },
      fields: this.graphics.fieldsOf(preset.graphic.fields),
    };
  }

  private soundRows(): Array<Record<string, unknown>> {
    return this.builtinSounds.list().map((sound) => this.soundRow(sound));
  }

  /**
   * A sound as the list shows it: what choosing one needs. Its volume under
   * a voice is left to the detail, since add_sounds applies it by default.
   */
  private soundRow(sound: BuiltinSound): Record<string, unknown> {
    return { id: sound.id, category: sound.category, sec: this.format.sec(sound.lengthSec), sounds: sound.description };
  }

  /** The files of the media bin, those a layer or a clip uses marked. */
  private mediaRows(): Array<Record<string, unknown>> {
    const state = this.store.snapshot();
    const used = new Set([...state.shots.mediaIdsInUse(), ...state.audio.mediaIdsInUse()]);
    return this.media.snapshot().list().map((asset) => ({
      id: asset.id,
      name: asset.fileName,
      type: asset.type === 'image' ? 'picture' : asset.type,
      ...(asset.durationSec === null ? {} : { sec: this.format.sec(asset.durationSec) }),
      ...(asset.widthPx === null || asset.heightPx === null ? {} : { width: asset.widthPx, height: asset.heightPx }),
      ...(used.has(asset.id) ? { used: true } : {}),
    }));
  }

  /** Each look with the adjustments it moves off neutral, each -1 to 1 (vignette 0 to 1). */
  private lookRows(): Array<Record<string, unknown>> {
    return this.looks.list().map((look) => ({
      id: look.id,
      name: look.label,
      values: Object.fromEntries(ColorGrade.fields()
        .filter((field) => look.grade.valueOf(field) !== 0)
        .map((field) => [field, this.format.share(look.grade.valueOf(field))])),
    }));
  }

  private wordTags(): Record<string, unknown> {
    return {
      tags: WORD_TAG_NAMES.map((tag) => ({ tag, label: TAG_METADATA[tag].label, means: TAG_METADATA[tag].description })),
      looks: 'A tagged word looks as its sheet\'s template styles .word.<tag>; a template that styles no such tag shows no difference.',
    };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
