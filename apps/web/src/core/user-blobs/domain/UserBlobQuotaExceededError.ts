/**
 * Thrown when the repository rejects a write because the blob quota
 * has been reached. `current` and `limit` describe the cap so the UI
 * can render a precise "X of Y used" message without re-querying.
 */
export class UserBlobQuotaExceededError extends Error {
  constructor(
    readonly current: number,
    readonly limit: number,
  ) {
    super(`User blob quota exceeded (${current}/${limit})`);
    this.name = 'UserBlobQuotaExceededError';
  }
}
