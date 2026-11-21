import type { ProjectFramePicture, ProjectFramePictureSet } from '@core/export/domain/ProjectFramePictures';
import type { SourceVideoPictures } from '@core/reframe/domain/SourceVideoPictures';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import type { PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import type { ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';

/**
 * Reads the source's picture by seeking an off-screen copy of the video
 * (the preview proxy where there is one: these pictures are for looking,
 * not for export). A moment past the video's end is left out, with a
 * note.
 */
export class SeekingSourceVideoPictures implements SourceVideoPictures {
  constructor(
    private readonly store: EditorStore,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly videoLoader: HiddenVideoLoader,
    private readonly frameReader: PrefetchingVideoFrameReader,
  ) {}

  async pictureAt(sourceSecs: ReadonlyArray<number>, signal: AbortSignal): Promise<ProjectFramePictureSet> {
    const video = this.store.snapshot().video;
    const source = this.sourceResolver.resolve(video);
    if (source === null) return { frames: [], width: 0, height: 0, notes: ['No video is loaded.'] };
    const inside = [...sourceSecs].filter((sec) => sec <= video.duration).sort((first, second) => first - second);
    const notes = inside.length < sourceSecs.length ? ['Moments past the end of the video were left out.'] : [];
    try {
      const element = await this.videoLoader.load(source.url);
      try {
        const frames: ProjectFramePicture[] = [];
        for await (const frame of this.frameReader.read(element, inside, signal)) {
          frames.push({ sourceSec: frame.timestamp, bitmap: frame.bitmap });
        }
        const first = frames[0]?.bitmap;
        return { frames, width: first?.width ?? 0, height: first?.height ?? 0, notes };
      } finally {
        this.videoLoader.dispose(element);
      }
    } finally {
      source.dispose();
    }
  }
}
