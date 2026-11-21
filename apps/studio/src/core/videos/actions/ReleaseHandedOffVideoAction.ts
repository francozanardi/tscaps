import type { EditorStore } from '@core/editor/store/EditorStore';
import type { HandedOffVideoFiles } from '@core/videos/services/HandedOffVideoFiles';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';

/**
 * Moves the editor off a video a landing handed it, onto the copy the
 * session keeps on this device, so nothing the editor does from then on
 * reads the handoff's entry.
 *
 * That entry is removed by the next studio page load once it is older
 * than the handoff keeps one, from any tab, whether this one still
 * reads it or not; a video read from it stops playing and cannot be
 * exported. The kept copy becomes the editor's original, and the
 * preview's file too when the preview plays the original, which the
 * preview then loads again where it was.
 *
 * Does nothing unless `handedOff` is a file the handoff gave and the
 * one the editor still holds, and nothing when this device keeps no
 * copy of it: the editor goes on reading the handoff, as it did before.
 * Never rejects.
 */
export class ReleaseHandedOffVideoAction {
  constructor(
    private readonly editorStore: EditorStore,
    private readonly handedOffFiles: HandedOffVideoFiles,
    private readonly keeper: OriginalVideoKeeper,
  ) {}

  async execute(handedOff: File): Promise<void> {
    if (!this.handedOffFiles.includes(handedOff) || !this.editorHolds(handedOff)) return;
    const kept = await this.keptCopy();
    if (kept === null || !this.editorHolds(handedOff)) return;
    this.replace(handedOff, new File([kept], handedOff.name, { type: handedOff.type || kept.type }));
  }

  private async keptCopy(): Promise<Blob | null> {
    try {
      const lookup = await this.keeper.copyOnThisDevice();
      // A copy held in memory is the handed-off file itself, kept there because this device refused to store it.
      return lookup.outcome === 'found' && lookup.source === 'device' ? lookup.blob : null;
    } catch (cause) {
      // Reading the handoff still works, as it did before; failing to
      // find another copy only leaves things as they were.
      console.warn('[videos] reading the copy kept on this device failed', cause);
      return null;
    }
  }

  private replace(handedOff: File, kept: File): void {
    const { video } = this.editorStore.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
    const previewPlaysIt = video.preview?.kind === 'original' && video.preview.file === handedOff;
    this.editorStore.patchVideo({
      file: kept,
      url: URL.createObjectURL(kept),
      ...(previewPlaysIt && video.preview ? { preview: { ...video.preview, file: kept } } : {}),
    });
  }

  private editorHolds(file: File): boolean {
    return this.editorStore.snapshot().video.file === file;
  }
}
