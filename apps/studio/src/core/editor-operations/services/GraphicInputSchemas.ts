import { z } from 'zod';
import { SHOT_LAYER_PLACEMENT_RANGES } from '@core/shots/domain/ShotLayerPlacementRanges';

const MAX_DOCUMENT_PART_CHARS = 100_000;
const MAX_FIELDS = 20;
const MAX_SOUNDS = 10;
const SHARE = z.number().min(0).max(1);

const HTML = z.string().max(MAX_DOCUMENT_PART_CHARS)
  .describe('The body of the page (no <html>, <head>, <body> or <script>).');
const CSS = z.string().max(MAX_DOCUMENT_PART_CHARS)
  .describe('How it looks.');
const JS = z.string().max(MAX_DOCUMENT_PART_CHARS)
  .describe('How it moves: sets tscaps.render.');

const FIELD = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  label: z.string().min(1).max(60),
  kind: z.enum(['text', 'color', 'number', 'image', 'emoji']),
  defaultValue: z.union([z.string(), z.number()]),
});
const FIELDS = z.array(FIELD).max(MAX_FIELDS)
  .describe('What a person can change without reading code.');

const ASPECT_RATIO = z.number().min(0.02).max(50)
  .describe('The box\'s width over its height.');

// A graphic starts in a box over the video; set_layer lays one that fills its part out over the whole frame or split.
const BOX = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('box'),
    centerX: SHARE,
    centerY: SHARE,
    width: z.number().min(SHOT_LAYER_PLACEMENT_RANGES.insetWidth.min).max(SHOT_LAYER_PLACEMENT_RANGES.insetWidth.max),
  }),
]).describe('Where its box sits first, in shares of the frame; centred, 0.8 of the frame\'s width, when left out.');

const ANIMATION = z.union([
  z.string().min(1),
  z.object({ animation: z.string().min(1) }).catchall(z.union([z.number(), z.string()])),
  z.null(),
]);
const MOTION = z.strictObject({
  entrance: ANIMATION.optional(),
  exit: ANIMATION.optional(),
}).describe('How the whole box enters and leaves, on top of what the code animates inside it.');

const SOUNDS = z.array(z.strictObject({
  moment: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  sound: z.string().min(1),
  volume: z.number().min(0).max(1).optional(),
})).max(MAX_SOUNDS).describe('Sounds to play on the moments the code declares.');

/**
 * How the operations that write a graphic take its parts, declared once
 * so each offers them with the same words and the same limits.
 * `customGraphic` is a whole graphic written from nothing, in the shape a
 * preset of `presets/graphics/` has.
 */
export const GRAPHIC_INPUT_SCHEMAS = {
  html: HTML,
  css: CSS,
  js: JS,
  fields: FIELDS,
  params: z.record(z.string(), z.union([z.string(), z.number()]))
    .describe('Values to set on the graphic\'s fields, by field id, each of its field\'s kind (a color as #rrggbb or #rrggbbaa). A field left out keeps its value.'),
  aspectRatio: ASPECT_RATIO,
  hidesCaptions: z.boolean()
    .describe('Keep the captions off the screen for the graphic\'s whole shot: for a graphic that carries the words itself, as a hook that writes the opening line does. Hook presets start with it on.'),
  customGraphic: z.strictObject({
    html: HTML,
    css: CSS,
    js: JS,
    fields: FIELDS.optional(),
    aspectRatio: ASPECT_RATIO.optional(),
    box: BOX.optional(),
    motion: MOTION.optional(),
    sounds: SOUNDS.optional(),
  }),
} as const;

/** A whole graphic written from nothing, as its input is checked. */
export type CustomGraphicInput = z.output<typeof GRAPHIC_INPUT_SCHEMAS.customGraphic>;

/** One of a custom graphic's motions, as its input is checked: an animation's id, the id with its values, or none. */
export type GraphicMotionInput = z.output<typeof ANIMATION>;
