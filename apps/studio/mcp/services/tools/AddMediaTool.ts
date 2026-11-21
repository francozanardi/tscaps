import path from 'node:path';
import { z } from 'zod';
import type { McpTool, McpToolAnswer } from '@mcp/domain/McpTool';
import type { EditorServer } from '@mcp/domain/EditorServer';
import type { SharedFiles } from '@mcp/domain/SharedFiles';
import type { PageCalls } from '@mcp/services/PageCalls';
import type { PathPolicy } from '@mcp/services/PathPolicy';
import type { ToolAnswers } from '@mcp/services/ToolAnswers';
import type { ToolArguments } from '@mcp/services/ToolArguments';

const ARGS = z.object({
  path: z.string().min(1).describe('Path of the file: a video or a picture (b-roll), a GIF, or a sound or music file. Absolute or relative to the working directory.'),
});

const TYPES: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
};
const ADD_TIMEOUT_MS = 10 * 60_000;

/** `add_media`: puts a file from disk in the open project's media bin. */
export class AddMediaTool implements McpTool {
  readonly name = 'add_media';
  readonly description = 'Adds a file from disk to the open project\'s media bin, as adding it in the editor does: a video or a picture to use as b-roll, a GIF, a sound or music. Answers the id the bin gives it, which place_media and add_sounds name it by. Look at a video, a picture or a GIF with look_at_media before using it.';
  readonly inputSchema = z.toJSONSchema(ARGS, { io: 'input' });

  constructor(
    private readonly server: EditorServer,
    private readonly media: SharedFiles,
    private readonly paths: PathPolicy,
    private readonly pageCalls: PageCalls,
    private readonly answers: ToolAnswers,
    private readonly args: ToolArguments,
  ) {}

  async run(args: Readonly<Record<string, unknown>>): Promise<McpToolAnswer> {
    const filePath = this.paths.fileToRead(this.args.read(ARGS, args).path);
    const params = {
      url: this.server.mediaUrl(this.media.share(filePath)),
      fileName: path.basename(filePath),
      mimeType: TYPES[path.extname(filePath).toLowerCase()] ?? '',
    };
    return this.answers.json(await this.pageCalls.call('add_media', params, ADD_TIMEOUT_MS));
  }
}
