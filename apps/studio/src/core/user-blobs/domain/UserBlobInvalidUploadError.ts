/**
 * Thrown when the repository refuses an upload because the payload
 * failed structural validation (mime mismatch, byte budget, malformed
 * asset). `reason` carries a user-facing message describing the
 * specific cause.
 */
export class UserBlobInvalidUploadError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'UserBlobInvalidUploadError';
  }
}
