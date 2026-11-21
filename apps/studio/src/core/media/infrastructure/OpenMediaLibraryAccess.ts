import type { MediaLibraryAccess } from '@core/media/domain/MediaLibraryAccess';

/** `MediaLibraryAccess` where the library is always open: it is kept on this device, for whoever uses it. */
export class OpenMediaLibraryAccess implements MediaLibraryAccess {
  isOpen(): boolean {
    return true;
  }
}
