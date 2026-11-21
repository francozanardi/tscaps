import { describe, expect, it } from 'vitest';
import { MediaAssetDragFormat, type MediaAssetDragData } from '@presentation/media/services/MediaAssetDragFormat';

/**
 * While a drag is under way a page may read its formats but not its
 * data, so whether a target takes it has to be answerable from the
 * formats alone.
 */

class InMemoryDragData implements MediaAssetDragData {
  private readonly data = new Map<string, string>();

  get types(): readonly string[] {
    return [...this.data.keys()];
  }

  setData(format: string, value: string): void {
    this.data.set(format, value);
  }

  getData(format: string): string {
    return this.data.get(format) ?? '';
  }
}

const format = new MediaAssetDragFormat();

describe('a media file in a drag', () => {
  it('tells its type from the formats alone', () => {
    const drag = new InMemoryDragData();
    format.write(drag, 'still', 'image');

    expect(format.carries(drag.types)).toBe(true);
    expect(format.carries(drag.types, ['image'])).toBe(true);
    expect(format.carries(drag.types, ['video'])).toBe(false);
  });

  it('hands over its id only to a reader asking for its type', () => {
    const drag = new InMemoryDragData();
    format.write(drag, 'clip', 'video');

    expect(format.read(drag, ['video'])).toBe('clip');
    expect(format.read(drag, ['gif'])).toBeNull();
  });

  it('hands over its id to a reader taking a file of any type', () => {
    const drag = new InMemoryDragData();
    format.write(drag, 'wave', 'gif');

    expect(format.read(drag)).toBe('wave');
    expect(format.read(new InMemoryDragData())).toBeNull();
  });

  it('is refused by a reader taking only other types, as a shot refuses a sound', () => {
    const drag = new InMemoryDragData();
    format.write(drag, 'theme', 'audio');

    expect(format.carries(drag.types)).toBe(true);
    expect(format.carries(drag.types, ['video', 'image', 'gif'])).toBe(false);
    expect(format.read(drag, ['video', 'image', 'gif'])).toBeNull();
  });

  it('is not mistaken for files dragged in from outside the page', () => {
    expect(format.carries(['Files'])).toBe(false);
  });
});
