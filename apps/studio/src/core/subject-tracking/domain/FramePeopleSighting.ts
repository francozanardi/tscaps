import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';

/**
 * Finds the people in one picture; coordinates are shares of it. The
 * picture stays the caller's, open. Rejects when the detector cannot run
 * on this device.
 */
export interface FramePeopleSighting {
  sight(picture: ImageBitmap): Promise<ReadonlyArray<PersonSighting>>;
}
