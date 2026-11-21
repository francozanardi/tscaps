/**
 * The key a sound's row is registered under as a spotlight on an
 * inspector page: its clip's own id, so a button pointing to that sound
 * lands on its row whichever page lists it.
 */
export function soundSpotlightKey(clipId: string): string {
  return `sound:${clipId}`;
}
