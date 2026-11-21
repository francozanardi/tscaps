import type { McpPictureType, McpToolAnswer, McpToolContent } from '@mcp/domain/McpTool';

/** A picture a result carries, as base64. */
interface ResultPicture {
  readonly mediaType: string;
  readonly base64: string;
}

/**
 * Shapes what tools answer: a value as indented JSON, optionally after a
 * sentence that says what to do next. A value that carries `pictures`
 * (base64, with their type) has them shown as pictures, after the rest of
 * it as JSON.
 */
export class ToolAnswers {
  json(value: unknown, lead?: string): McpToolAnswer {
    const content: McpToolContent[] = [];
    if (lead !== undefined) content.push({ type: 'text', text: lead });
    if (!this.hasPictures(value)) {
      content.push({ type: 'text', text: JSON.stringify(value, null, 2) });
      return { content };
    }
    const { pictures, ...rest } = value;
    content.push({ type: 'text', text: JSON.stringify(rest, null, 2) });
    for (const picture of pictures) content.push({ type: 'image', mimeType: this.pictureType(picture.mediaType), data: picture.base64 });
    return { content };
  }

  text(text: string): McpToolAnswer {
    return { content: [{ type: 'text', text }] };
  }

  private hasPictures(value: unknown): value is { pictures: ReadonlyArray<ResultPicture> } {
    return typeof value === 'object' && value !== null && Array.isArray((value as { pictures?: unknown }).pictures);
  }

  private pictureType(mediaType: string): McpPictureType {
    return mediaType === 'image/jpeg' || mediaType === 'image/webp' ? mediaType : 'image/png';
  }
}
