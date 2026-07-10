import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ScreenWakeLock } from '@presentation/editor/controllers/ScreenWakeLock';

/**
 * Keeps the screen awake while the editor is in playback. Acquires
 * the wake lock when the store reports `isPlaying === true` and
 * releases it on pause. The canvas-based preview does not register
 * as native video playback with the OS, so without this controller
 * mobile devices dim and sleep mid-watch.
 */
export class PlaybackScreenWakeLockController {

  private running = false;
  private locked = false;

  constructor(
    private readonly store: EditorStore,
    private readonly wakeLock: ScreenWakeLock,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.store.addEventListener('change', this.onStoreChange);
    this.sync();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.store.removeEventListener('change', this.onStoreChange);
    this.releaseIfLocked();
  }

  private readonly onStoreChange = (): void => {
    this.sync();
  };

  private sync(): void {
    if (this.store.snapshot().video.isPlaying) {
      this.acquireIfUnlocked();
    } else {
      this.releaseIfLocked();
    }
  }

  private acquireIfUnlocked(): void {
    if (this.locked) return;
    this.wakeLock.start();
    this.locked = true;
  }

  private releaseIfLocked(): void {
    if (!this.locked) return;
    this.wakeLock.stop();
    this.locked = false;
  }
}
