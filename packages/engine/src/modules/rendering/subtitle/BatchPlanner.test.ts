import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import { SvgFilter } from '@modules/svg-filter/SvgFilter';
import { SvgFilterBundle } from '@modules/svg-filter/SvgFilterBundle';
import { SvgFilterDefinitions } from '@modules/svg-filter/SvgFilterDefinitions';
import { SvgFilterDefsRenderer } from '@modules/svg-filter/SvgFilterDefsRenderer';
import { SvgFilterLengthResolver } from '@modules/svg-filter/SvgFilterLengthResolver';
import { SvgFilterScope } from '@modules/svg-filter/SvgFilterScope';
import { SvgFilterScoper } from '@modules/svg-filter/SvgFilterScoper';
import type {
  SvgFilterLengthFactors,
  SvgFilterRenderContext,
  SvgFilterScopeProvider,
} from '@modules/svg-filter/SvgFilterScopeProvider';
import { BatchPlanner } from '@modules/rendering/subtitle/BatchPlanner';
import { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { CaptionStacking } from '@modules/rendering/types/CaptionStacking';
import { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';
import { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
import { SvgFilterStateFingerprint } from '@modules/rendering/subtitle/SvgFilterStateFingerprint';
import type { AnimationStateFingerprint } from '@modules/rendering/subtitle/AnimationStateFingerprint';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';

/**
 * How many tiles a set of timestamps collapses into, which is what
 * decides how many times the export rasterizes the same caption.
 *
 * The animation half of the question needs a browser to answer — it
 * mounts the subtree and asks what runs on it — so these run against a
 * subject that says nothing is animating. What is under test is the
 * other half: whether the filter a caption is painted through can
 * change between two timestamps, which is decided from the filter
 * document and the scope alone.
 */

const KIND = 'main';
const OTHER_KIND = 'hook';
const SEGMENT_WINDOW = new TimeFragment(0, 2);
const LENGTH_FACTORS: SvgFilterLengthFactors = { pxPerEm: 16, pxPerCqh: 10 };
const RENDER_HEIGHT_PX = 1000;

const NOTHING_ANIMATES = { at: () => Promise.resolve('') } as unknown as AnimationStateFingerprint;

/** A scope whose entries are the same at every timestamp. */
class StillScopeProvider implements SvgFilterScopeProvider {
  scopeAt(): SvgFilterScope {
    return SvgFilterScope.fromEntries([['--tscaps-outline-color', '#000000']]);
  }

  lengthFactorsAt(): SvgFilterLengthFactors {
    return LENGTH_FACTORS;
  }
}

/** A scope carrying an integer that advances 60 times per second. */
class TickingScopeProvider implements SvgFilterScopeProvider {
  scopeAt(context: SvgFilterRenderContext): SvgFilterScope {
    return SvgFilterScope.fromEntries([
      ['--tscaps-outline-color', '#000000'],
      ['--tscaps-tick-60', String(Math.floor(context.currentTime * 60))],
    ]);
  }

  lengthFactorsAt(): SvgFilterLengthFactors {
    return LENGTH_FACTORS;
  }
}

/** A scope whose text size changes with the timestamp. */
class StretchingScopeProvider implements SvgFilterScopeProvider {
  scopeAt(): SvgFilterScope {
    return SvgFilterScope.fromEntries([['--tscaps-outline-color', '#000000']]);
  }

  lengthFactorsAt(context: SvgFilterRenderContext): SvgFilterLengthFactors {
    return { pxPerEm: 16 + context.currentTime, pxPerCqh: 10 };
  }
}

function filterReading(body: string): SvgFilterDefinitions {
  return new SvgFilterDefinitions([new SvgFilter('outline', new Map([['x', '-20%']]), body)]);
}

const OUTLINE_BODY = '<feFlood flood-color="var(--tscaps-outline-color)"/>'
  + '<feMorphology radius="var(--tscaps-outline-thickness, 0.08)em"/>';
const SEEDED_BODY = `${OUTLINE_BODY}<feTurbulence seed="var(--tscaps-tick-60)"/>`;

function documentWithOneWord(): Document {
  const word = new Word({ text: 'hola', time: SEGMENT_WINDOW, id: 'w1' });
  const line = new Line({ words: [word], id: 'l1' });
  const segment = new Segment({ lines: [line], id: 's1' });
  return new Document({ sections: [new Section({ segments: [segment], kind: KIND, id: 'sec1' })] });
}

/** Two sections back to back, each on a style of its own, so a batch spanning both holds two groups. */
function documentWithTwoKinds(): Document {
  const wordsFrom = (start: number) => [0, 1].map((i) => new Word({
    text: `w${i}`,
    time: new TimeFragment(start + i * 0.5, start + (i + 1) * 0.5),
    id: `${start}w${i}`,
  }));
  const sectionAt = (start: number, kind: string) => new Section({
    segments: [new Segment({ lines: [new Line({ words: wordsFrom(start), id: `l${kind}` })], id: `s${kind}` })],
    kind,
    id: `sec-${kind}`,
  });
  return new Document({ sections: [sectionAt(0, KIND), sectionAt(1, OTHER_KIND)] });
}

function styleWith(
  filters: SvgFilterBundle,
  kind: string = KIND,
  paintsVideoFrame = false,
  subtreeOverrides: ElementRenderOverrides = ElementRenderOverrides.empty(),
): PreparedStyle {
  const rendering = { videoFrame: { required: paintsVideoFrame, jpegQuality: 0.75 } };
  return {
    kind, filters, rendering, subtreeOverrides, segmentOverrides: ElementRenderOverrides.empty(), decorationPlacements: new Map(),
  } as unknown as PreparedStyle;
}

const ROOM_FOR_EVERY_PICTURE = 100;

function plannerFor(
  filters: SvgFilterBundle,
  paintsVideoFrame = false,
  subtreeOverrides: ElementRenderOverrides = ElementRenderOverrides.empty(),
  layer: CaptionLayer = CaptionLayer.BASE,
): BatchPlanner {
  return new BatchPlanner(
    documentWithOneWord(),
    { [KIND]: styleWith(filters, KIND, paintsVideoFrame, subtreeOverrides) },
    NOTHING_ANIMATES,
    new SvgFilterStateFingerprint(
      new SvgFilterDefsRenderer(new SvgFilterScoper(), new SvgFilterLengthResolver()),
      RENDER_HEIGHT_PX,
    ),
    new SegmentSubtreeDecomposer(),
    layer,
  );
}

async function tileCount(
  filters: SvgFilterBundle,
  timestamps: ReadonlyArray<number>,
  paintsVideoFrame = false,
  subtreeOverrides: ElementRenderOverrides = ElementRenderOverrides.empty(),
): Promise<number> {
  const plan = await plannerFor(filters, paintsVideoFrame, subtreeOverrides).plan([...timestamps], ROOM_FOR_EVERY_PICTURE);
  return plan.groups.get(KIND)?.uniqueTiles.length ?? 0;
}

// Far enough apart to be different frames, close enough to sit in the
// same word state and the same 1/60 s tick.
const SAME_TICK = [1.0, 1.008];
const DIFFERENT_TICKS = [1.0, 1.5];

describe('a style with no filters', () => {
  it('shares one tile across timestamps in the same state', async () => {
    const bundle = new SvgFilterBundle(SvgFilterDefinitions.empty(), new StillScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(1);
  });
});

describe('a style that paints the video frame', () => {
  const noFilters = () => new SvgFilterBundle(SvgFilterDefinitions.empty(), new StillScopeProvider());

  it('takes a tile per timestamp, because the pixels behind the caption move even where the caption does not', async () => {
    expect(await tileCount(noFilters(), DIFFERENT_TICKS, true)).toBe(2);
  });

  it('takes them even for timestamps close enough to share every other part of the state', async () => {
    expect(await tileCount(noFilters(), SAME_TICK, true)).toBe(2);
  });

  it('leaves a style that does not paint the frame sharing its tile', async () => {
    expect(await tileCount(noFilters(), DIFFERENT_TICKS, false)).toBe(1);
  });
});

// A blend is applied when its layer is composited, so the raster holds
// nothing of the frame: a blended element that does not move is one
// picture for as long as it is on screen.
describe('an element blended with the video', () => {
  const noFilters = () => new SvgFilterBundle(SvgFilterDefinitions.empty(), new StillScopeProvider());
  const blended = ElementRenderOverrides.fromEntries([['w1', { blendMode: CaptionBlendMode.DIFFERENCE }]]);
  const blendLayer = CaptionLayer.of(CaptionStacking.UNDER_TOP_LAYER, CaptionBlendMode.DIFFERENCE);

  it('shares its tile across timestamps, in its own layer', async () => {
    const plan = await plannerFor(noFilters(), false, blended, blendLayer).plan(DIFFERENT_TICKS, ROOM_FOR_EVERY_PICTURE);
    expect(plan.assignments.every((assignment) => assignment !== null)).toBe(true);
    expect(plan.groups.get(KIND)!.uniqueTiles).toHaveLength(1);
  });

  it('is not planned at all by a layer nothing of its segment paints in', async () => {
    const elsewhere = CaptionLayer.of(CaptionStacking.OVER_TOP_LAYER, CaptionBlendMode.DIFFERENCE);
    const plan = await plannerFor(noFilters(), false, blended, elsewhere).plan(DIFFERENT_TICKS, ROOM_FOR_EVERY_PICTURE);
    expect(plan.groups.size).toBe(0);
  });
});

describe('a filter that resolves to the same markup at every timestamp', () => {
  it('shares one tile, because the pixels it paints cannot differ', async () => {
    const bundle = new SvgFilterBundle(filterReading(OUTLINE_BODY), new StillScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(1);
  });

  it('shares it even where the scope ticks, as long as the filter does not read the tick', async () => {
    const bundle = new SvgFilterBundle(filterReading(OUTLINE_BODY), new TickingScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(1);
  });
});

describe('a filter reading a value that moves', () => {
  it('takes a tile per timestamp that resolves it differently', async () => {
    const bundle = new SvgFilterBundle(filterReading(SEEDED_BODY), new TickingScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(2);
  });

  it('still shares a tile between two timestamps inside one tick', async () => {
    const bundle = new SvgFilterBundle(filterReading(SEEDED_BODY), new TickingScopeProvider());
    expect(await tileCount(bundle, SAME_TICK)).toBe(1);
  });

  it('counts a length the scope resolves per timestamp, not only a substituted value', async () => {
    const bundle = new SvgFilterBundle(filterReading(OUTLINE_BODY), new StretchingScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(2);
  });
});

describe('how far a batch reaches', () => {
  const stillFilter = () => new SvgFilterBundle(filterReading(OUTLINE_BODY), new StillScopeProvider());
  const everyFrameOfTheWord = Array.from({ length: 40 }, (_, i) => 0.5 + i * 0.01);

  it('carries a still caption past the pictures its sheet can hold', async () => {
    const plan = await plannerFor(stillFilter()).plan(everyFrameOfTheWord, 2);
    expect(plan.assignments).toHaveLength(everyFrameOfTheWord.length);
    expect(plan.groups.get(KIND)!.uniqueTiles).toHaveLength(1);
  });

  it('stops at the timestamp whose picture no longer fits', async () => {
    const ticking = new SvgFilterBundle(filterReading(SEEDED_BODY), new TickingScopeProvider());
    const plan = await plannerFor(ticking).plan(everyFrameOfTheWord, 2);
    expect(plan.groups.get(KIND)!.uniqueTiles).toHaveLength(2);
    expect(plan.assignments.length).toBeLessThan(everyFrameOfTheWord.length);
    expect(plan.assignments.length).toBeGreaterThan(0);
  });

  // Two sheets are two rasters against one budget, so a batch that
  // spent it on one group has nothing left for the next.
  it('spends one budget across every group, not one budget each', async () => {
    const bundle = stillFilter();
    const planner = new BatchPlanner(
      documentWithTwoKinds(),
      { [KIND]: styleWith(bundle), [OTHER_KIND]: styleWith(bundle, OTHER_KIND) },
      NOTHING_ANIMATES,
      new SvgFilterStateFingerprint(
        new SvgFilterDefsRenderer(new SvgFilterScoper(), new SvgFilterLengthResolver()),
        RENDER_HEIGHT_PX,
      ),
      new SegmentSubtreeDecomposer(),
      CaptionLayer.BASE,
    );
    const plan = await planner.plan([0.1, 0.6, 1.1, 1.6], 2);
    const tiles = [...plan.groups.values()].reduce((total, group) => total + group.uniqueTiles.length, 0);
    expect(tiles).toBe(2);
    expect(plan.assignments).toHaveLength(2);
  });

  it('covers the whole offer when it is no longer than the room available', async () => {
    const ticking = new SvgFilterBundle(filterReading(SEEDED_BODY), new TickingScopeProvider());
    const offered = everyFrameOfTheWord.slice(0, 5);
    expect((await plannerFor(ticking).plan(offered, offered.length)).assignments).toHaveLength(offered.length);
  });
});

/** A scope that stops carrying its variable partway, having held nothing in it until then. */
class FadingScopeProvider implements SvgFilterScopeProvider {
  scopeAt(context: SvgFilterRenderContext): SvgFilterScope {
    if (context.currentTime >= 1) return SvgFilterScope.empty();
    return SvgFilterScope.fromEntries([['--tscaps-outline-color', '']]);
  }

  lengthFactorsAt(): SvgFilterLengthFactors {
    return LENGTH_FACTORS;
  }
}

describe('a filter reading a variable the scope leaves unresolved', () => {
  it('is told apart from one resolved to nothing, which paints something else entirely', async () => {
    const body = '<feFlood flood-color="var(--tscaps-outline-color)"/>';
    const bundle = new SvgFilterBundle(filterReading(body), new FadingScopeProvider());
    expect(await tileCount(bundle, [0.5, 1.5])).toBe(2);
  });

  it('takes a tile per timestamp, since the document decides the value and this side cannot see it', async () => {
    const body = '<feFlood flood-color="var(--on-word-being-narrated-starts)"/>';
    const bundle = new SvgFilterBundle(filterReading(body), new StillScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(2);
  });

  it('shares a tile when that reference carries a fallback, which is what gets painted', async () => {
    const body = '<feFlood flood-color="var(--tscaps-unset, #ff0000)"/>';
    const bundle = new SvgFilterBundle(filterReading(body), new StillScopeProvider());
    expect(await tileCount(bundle, DIFFERENT_TICKS)).toBe(1);
  });
});
