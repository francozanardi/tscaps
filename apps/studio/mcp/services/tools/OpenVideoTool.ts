import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { EditorServer } from '@mcp/domain/EditorServer';
import type { SharedFiles } from '@mcp/domain/SharedFiles';
import type { BackgroundJobs } from '@mcp/services/BackgroundJobs';
import type { EditorSession } from '@mcp/services/EditorSession';
import type { JobReport } from '@mcp/services/JobReport';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { PathPolicy } from '@mcp/services/PathPolicy';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  video: z.string().min(1).describe('Path of the video file, absolute or relative to the working directory.'),
  subtitles: z.string().min(1).optional().describe([
    'Path of a file to take the captions and their timing from, instead of transcribing: SRT, VTT (the word times it marks inside a cue are kept),',
    'or JSON with each word\'s text and its start and end in seconds, as Whisper, WhisperX and most transcription services write it',
    '({ "words": [...] } or { "segments": [{ "words": [...] }] }, each word as { "word" or "text", "start", "end" }).',
    'Without it, the speech is transcribed in the browser, which takes a while on a long video.',
  ].join(' ')),
  language: z.string().min(2).max(16).optional().describe('The language spoken, as a code such as en or es, when transcribing. Detected when left out.'),
  model: z.enum(['tiny', 'base', 'small', 'medium']).default('small').describe([
    'The Whisper model that transcribes the speech in the browser, when there is no subtitles file.',
    'Larger models hear more and take longer: small, the default, is right for most videos; medium for a hard recording',
    '(noise, accents, several voices at once); tiny or base only when speed matters more than every word.',
  ].join(' ')),
});

const VIDEO_TYPES: Readonly<Record<string, string>> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska' };
const PREPARE_TIMEOUT_MS = 60 * 60_000;
const WAIT_MS = 25_000;

/** `open_video`: starts a project from a video file, opening the editor page first when it is not open. */
export class OpenVideoTool implements McpTool {
  readonly name = 'open_video';
  readonly description = [
    'Opens a video in the tscaps editor and prepares its captions: from a captions file when given (SRT, VTT, or JSON of word timings), else by transcribing the speech in the browser with Whisper.',
    'The editor opens in a page the person can watch and edit in; every change you make shows there, and the person can undo it.',
    'Answers the project once it is ready, or a job id to pass to wait_for_job when preparing takes longer than about 25 seconds.',
    'Opening another video replaces the project shown.',
  ].join(' ');
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly session: EditorSession,
    private readonly server: EditorServer,
    private readonly media: SharedFiles,
    private readonly paths: PathPolicy,
    private readonly pageCalls: PageCalls,
    private readonly jobs: BackgroundJobs,
    private readonly report: JobReport,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const { video, subtitles, language, model } = this.args.read(ARGS, args);
    const videoPath = this.paths.fileToRead(video);
    const params = {
      url: this.server.mediaUrl(this.media.share(videoPath)),
      fileName: path.basename(videoPath),
      mimeType: VIDEO_TYPES[path.extname(videoPath).toLowerCase()] ?? '',
      ...(subtitles === undefined ? {} : { subtitles: this.subtitleFile(subtitles) }),
      ...(language === undefined ? {} : { language }),
      ...(subtitles === undefined ? { model } : {}),
    };
    const job = await this.jobs.start('open_video', () => this.pageCalls.callForJob('open_video', params, PREPARE_TIMEOUT_MS), WAIT_MS);
    const answer = this.report.answer(job.id, job.state);
    if (job.state.state === 'failed') return answer;
    return { ...answer, content: [{ type: 'text', text: `The editor is open in ${this.session.whereThePageOpens}.` }, ...answer.content] };
  }

  private subtitleFile(given: string): { name: string; text: string } {
    const filePath = this.paths.fileToRead(given);
    return { name: path.basename(filePath), text: readFileSync(filePath, 'utf8') };
  }
}
