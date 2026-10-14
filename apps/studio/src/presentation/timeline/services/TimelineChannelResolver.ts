import type { Document, Section } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TimelineSceneExtent, TimelineSceneExtentResolver } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/** One readable track of the timeline: the sheets drawn in it, and its name. */
export interface TimelineChannel {
  readonly id: string;
  readonly name: string;
  readonly sheetIds: ReadonlyArray<string>;
}

/**
 * The channel every sheet that overlaps nothing is read in.
 *
 * Fixed, never borrowed from whichever sheet leads the pool: the main
 * sheet drops out of it the moment it holds no segments, so an id
 * following the lead changes under a reader who never left the channel.
 * Anything comparing channels then reads that as every sheet in the
 * pool having moved somewhere else.
 */
const MAIN_CHANNEL_ID = 'main-channel';

/**
 * Which channel each sheet is read in.
 *
 * The timeline draws **one channel at a time**, and a channel is a single
 * sequence: at any instant it holds at most one scene. That is the whole
 * rule, and everything below follows from it.
 *
 * **The main channel is the only pool.** The main sheet anchors it come
 * what may — it is the transcript, and a reader who had to go looking for
 * it in a list would have lost the thread already. On top of that the pool
 * takes every sheet that overlaps nothing: a hook, or anything else that
 * merely restyles a stretch of the same narration, belongs with it, and
 * splitting those out would mean changing channel to keep reading a
 * transcript straight through.
 *
 * **Every sheet that overlaps something gets a channel to itself**, never
 * shared with another overflow sheet even when the two would fit side by
 * side. Packing them by what happens to fit is interval colouring: the
 * result carries no meaning a reader could name, and one edit repacks
 * tracks the reader never touched. The same algorithm was tried a layer
 * down, assigning scenes to lanes, and removed for the same reasons.
 *
 * Overlap is measured on the **drawn** extent, padding included, because
 * that is what would collide on screen — not on the narrower window an
 * edit is clamped to.
 *
 * A sheet with no segments is in no channel: there is nothing to read.
 */
export class TimelineChannelResolver {

  constructor(private readonly extentResolver: TimelineSceneExtentResolver) {}

  /** The main channel first, then the rest in the sheets' own order. */
  resolve(document: Document, sheets: ReadonlyArray<Sheet>): TimelineChannel[] {
    const extentsBySheetId = this.extentsBySheetId(document);
    const parallel = this.parallelSheetIds(extentsBySheetId);
    const drawn = sheets.filter((sheet) => extentsBySheetId.has(sheet.id));
    const pooled = drawn
      .filter((sheet) => sheet.id === MAIN_SHEET_ID || !parallel.has(sheet.id))
      .map((sheet) => sheet.id);
    const channels: TimelineChannel[] = [];
    if (pooled.length > 0) channels.push(this.mainChannel(pooled, sheets));
    for (const sheet of drawn) {
      if (pooled.includes(sheet.id)) continue;
      channels.push({ id: sheet.id, name: sheet.name, sheetIds: [sheet.id] });
    }
    return channels;
  }

  // Named after the main sheet when it is in there, and after whatever
  // leads the pool otherwise — a channel the reader cannot name is a
  // channel they cannot choose. The name follows the lead; the identity
  // does not.
  private mainChannel(pooled: ReadonlyArray<string>, sheets: ReadonlyArray<Sheet>): TimelineChannel {
    const anchorId = pooled.includes(MAIN_SHEET_ID) ? MAIN_SHEET_ID : pooled[0]!;
    const anchor = sheets.find((sheet) => sheet.id === anchorId);
    return { id: MAIN_CHANNEL_ID, name: anchor?.name ?? 'Main', sheetIds: pooled };
  }

  private extentsBySheetId(document: Document): Map<string, TimelineSceneExtent[]> {
    const bySheetId = new Map<string, TimelineSceneExtent[]>();
    for (const section of document.sections) this.collect(section, bySheetId);
    return bySheetId;
  }

  // A hidden scene collides with nothing on screen, so it cannot make
  // its sheet parallel to another.
  private collect(section: Section, bySheetId: Map<string, TimelineSceneExtent[]>): void {
    const painted = section.segments.filter((segment) => !segment.hidden);
    if (painted.length === 0) return;
    const extents = this.extentResolver.resolve(painted);
    const existing = bySheetId.get(section.kind);
    if (existing) existing.push(...extents);
    else bySheetId.set(section.kind, extents);
  }

  // One sweep in start order: whenever two scenes are open at once and
  // they come from different sheets, both sheets are parallel.
  private parallelSheetIds(extentsBySheetId: ReadonlyMap<string, TimelineSceneExtent[]>): Set<string> {
    const ordered = [...extentsBySheetId]
      .flatMap(([sheetId, extents]) => extents.map((extent) => ({ sheetId, extent })))
      .sort((a, b) => a.extent.startSec - b.extent.startSec);
    const parallel = new Set<string>();
    let open: Array<{ sheetId: string; extent: TimelineSceneExtent }> = [];
    for (const entry of ordered) {
      open = open.filter((other) => other.extent.endSec > entry.extent.startSec);
      for (const other of open) {
        if (other.sheetId === entry.sheetId) continue;
        parallel.add(other.sheetId);
        parallel.add(entry.sheetId);
      }
      open.push(entry);
    }
    return parallel;
  }
}
