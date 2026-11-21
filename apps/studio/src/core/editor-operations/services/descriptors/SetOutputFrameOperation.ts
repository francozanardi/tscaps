import { z } from 'zod';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SetOutputFrameAction } from '@core/output-frame/actions/SetOutputFrameAction';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';

/**
 * `set_output_frame`: changes the shape the video is exported and
 * previewed in, and how the video sits in it, starting from the frame
 * it has. A change of the frame's size lays the captions out again,
 * which the answer warns about: their segment and line refs change.
 */
export class SetOutputFrameOperation implements EditorOperation {
  readonly name = 'set_output_frame';
  readonly effect = 'edit';
  readonly description = [
    'Change the shape of the output video (format) and how the video sits in it (fit, backdrop, crop); what is not given keeps what the frame has.',
    'A new shape keeps the video\'s shorter side: a 1920x1080 video in 9:16 is 1080x1920.',
    'When the frame\'s size changes the captions are laid out again: segment and line refs change, so read the transcript again before using them (word refs hold).',
    'After a change of shape the same crop holds for every shot, and one that suits a shot can cut the person out of another: frame each shot on its subject with set_framing.',
  ].join(' ');

  private readonly input = new OperationInput({
    format: z.enum(OutputFrame.formats()).optional()
      .describe('The shape, width:height: original (the video\'s own), 9:16 (Reels, TikTok, Shorts), 1:1 or 4:5 (feeds), 16:9 (YouTube).'),
    fit: z.enum(['fill', 'fit']).optional()
      .describe('How the video enters a frame of another shape: fill covers the frame and crops what falls outside it; fit shows the whole video over a backdrop.'),
    backdrop: z.enum(['black', 'blur']).optional().describe('What shows around a fitted video: black, or the video itself, blurred.'),
    cropX: z.number().min(0).max(1).optional()
      .describe('Filled only: which part of a video wider than the frame is kept, 0 = its left edge, 0.5 = the middle, 1 = its right edge.'),
    cropY: z.number().min(0).max(1).optional()
      .describe('Filled only: which part of a video taller than the frame is kept, 0 = its top, 0.5 = the middle, 1 = its bottom.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly setFrame: SetOutputFrameAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { format, fit, backdrop, cropX, cropY } = checked.value;
    if ([format, fit, backdrop, cropX, cropY].every((value) => value === undefined)) {
      return this.refused([{ severity: 'error', message: 'Give at least one of format, fit, backdrop, cropX or cropY.' }]);
    }
    const { outputFrame: current, frameLayout: sizeBefore, document, video } = this.store.snapshot();
    const croppedBefore = current.croppedAxis(video.layout);
    let frame = current;
    if (format !== undefined) frame = frame.withFormat(format);
    if (fit !== undefined) frame = frame.withFit(fit);
    if (backdrop !== undefined) frame = frame.withBackdrop(backdrop);
    if (cropX !== undefined || cropY !== undefined) frame = frame.withPosition({ x: cropX ?? frame.position.x, y: cropY ?? frame.position.y });
    this.setFrame.execute(frame);
    const sizeAfter = this.store.snapshot().frameLayout;
    const relaid = document !== null && sizeAfter !== null && !this.sameSize(sizeBefore, sizeAfter);
    const croppedAfter = this.store.snapshot().outputFrame.croppedAxis(video.layout);
    const problems: OperationProblem[] = [];
    if (relaid) {
      problems.push({
        severity: 'warning',
        message: 'The frame changed size, so the captions were laid out again: segment and line refs may have changed. Read the transcript again before using them; word refs still hold.',
      });
    }
    if (croppedAfter !== null && croppedAfter !== croppedBefore) problems.push(this.reframeSteps(croppedAfter));
    return { ok: true, output: this.frameOf(this.store.snapshot().outputFrame, sizeAfter), problems };
  }

  /** What is left to do once the frame starts cropping the picture: the same crop rarely suits every shot. */
  private reframeSteps(axis: 'x' | 'y'): OperationProblem {
    const across = axis === 'x' ? 'the sides' : 'the top and bottom';
    return {
      severity: 'warning',
      message: `The frame now crops ${across} of the picture at the same place in every shot, which can show nobody or cut a head where the subject sits elsewhere. Frame those shots on their subject with set_framing.`,
    };
  }

  private frameOf(frame: OutputFrame, size: VideoLayout | null): Record<string, unknown> {
    return {
      format: frame.format,
      fit: frame.fit,
      backdrop: frame.backdrop,
      cropX: frame.position.x,
      cropY: frame.position.y,
      size: size === null ? null : { width: size.width, height: size.height },
    };
  }

  private sameSize(first: VideoLayout | null, second: VideoLayout | null): boolean {
    if (first === null || second === null) return first === second;
    return first.width === second.width && first.height === second.height;
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
