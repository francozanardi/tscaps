import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { McpTool, McpToolAnswer, McpToolContent } from '@mcp/domain/McpTool';
import type { FileReservations } from '@mcp/domain/FileReservations';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { ScratchFolder } from '@mcp/services/ScratchFolder';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  times: z.array(z.number().min(0)).min(1).max(12).describe('Moments to look at, in seconds of the source video (the transcript\'s times): up to 8, or up to 12 in a strip.'),
  strip: z.boolean().default(false).describe('One picture holding every moment side by side, each under its time, instead of one picture each. For how something moves across its time: a graphic or a scene from its first moment to its last, a camera move, a transition.'),
  maxSidePx: z.number().int().min(128).max(2048).default(768).describe('The longer side of each picture, in pixels.'),
  region: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional()
    .describe('Zoom on one part of the frame, in shares of its width and height (0 to 1), for detail such as a word\'s outline or a graphic\'s text.'),
});

// Past this many, separate pictures cost more than a model should spend on one look: a strip holds them.
const MAX_SEPARATE = 8;

/** What the page answers for the pictures it painted. */
interface PaintedFrames {
  readonly frames?: ReadonlyArray<{ readonly sourceSec: number; readonly file: string; readonly width: number; readonly height: number }>;
  readonly strip?: { readonly file: string; readonly width: number; readonly height: number; readonly times: ReadonlyArray<number> } | null;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly notes: ReadonlyArray<string>;
}

/** `render_frames`: pictures of the output at chosen moments, painted as the export paints them. */
export class RenderFramesTool implements McpTool {
  readonly name = 'render_frames';
  readonly description = [
    'Paints the output frame at chosen moments exactly as the exported video will show it (video, layers, graphics, captions, colour),',
    'and answers each as a picture, also written as a PNG file whose path is given. Use it to check every change you make before saying it is done;',
    'pass `region` to zoom on a small element, and `strip` to see how something moves, as one picture of its moments in order.',
  ].join(' ');
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly pageCalls: PageCalls,
    private readonly files: FileReservations,
    private readonly scratch: ScratchFolder,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const read = this.args.read(ARGS, args);
    const { maxSidePx, region, strip } = read;
    // A moment asked twice is one picture: the page writes each moment once.
    const times = [...new Set(read.times)];
    if (strip) return this.stripOf(times, region);
    if (times.length > MAX_SEPARATE) throw new Error(`render_frames paints up to ${MAX_SEPARATE} separate pictures; pass strip: true for up to 12 moments in one.`);
    const stamp = Date.now();
    const paths = times.map((time, index) => this.scratch.pathFor(`frame-${stamp}-${index}-${time.toFixed(2)}s.png`));
    const ids = paths.map((filePath) => this.files.reserve(filePath));
    try {
      const painted = (await this.pageCalls.call('render_frames', { times, files: ids, maxSidePx, ...(region === undefined ? {} : { region }) })) as PaintedFrames;
      return { content: this.contentOf(painted, times, ids, paths) };
    } finally {
      await Promise.all(ids.map((id) => this.files.release(id)));
    }
  }

  /** The moments `times` as one picture, side by side in order. */
  private async stripOf(times: ReadonlyArray<number>, region: { x: number; y: number; width: number; height: number } | undefined): Promise<McpToolAnswer> {
    const filePath = this.scratch.pathFor(`strip-${Date.now()}.jpg`);
    const id = this.files.reserve(filePath);
    try {
      const painted = (await this.pageCalls.call('render_frames', { times, stripFile: id, ...(region === undefined ? {} : { region }) })) as PaintedFrames;
      const notes: McpToolContent[] = painted.notes.length > 0 ? [{ type: 'text', text: `Notes: ${painted.notes.join(' ')}` }] : [];
      if (painted.strip === null || painted.strip === undefined) return { content: [{ type: 'text', text: 'No picture could be painted.' }, ...notes] };
      const held = painted.strip.times.map((time) => `${time} s`).join(', ');
      return {
        content: [
          { type: 'text', text: `One picture of ${painted.strip.times.length} moments in order, each under its time (${held}; output ${painted.outputWidth}×${painted.outputHeight}): ${filePath}` },
          { type: 'image', mimeType: 'image/jpeg', data: readFileSync(filePath).toString('base64') },
          ...notes,
        ],
      };
    } finally {
      await this.files.release(id);
    }
  }

  private contentOf(painted: PaintedFrames, times: ReadonlyArray<number>, ids: ReadonlyArray<string>, paths: ReadonlyArray<string>): McpToolContent[] {
    const content: McpToolContent[] = [];
    const frames = painted.frames ?? [];
    for (const frame of frames) {
      const filePath = paths[ids.indexOf(frame.file)] ?? '';
      content.push({ type: 'text', text: `At ${frame.sourceSec} s (${frame.width}×${frame.height}, output ${painted.outputWidth}×${painted.outputHeight}): ${filePath}` });
      content.push({ type: 'image', mimeType: 'image/png', data: readFileSync(filePath).toString('base64') });
    }
    if (painted.notes.length > 0) content.push({ type: 'text', text: `Notes: ${painted.notes.join(' ')}` });
    const missed = times.filter((time) => !frames.some((frame) => frame.sourceSec === time));
    if (frames.length === 0) content.push({ type: 'text', text: 'No picture could be painted.' });
    else if (missed.length > 0) content.push({ type: 'text', text: `No picture at ${missed.map((time) => `${time} s`).join(', ')}.` });
    return content;
  }
}
