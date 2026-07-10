/**
 * Raised when saving one more template would push the library past
 * its per-user cap. Carries the current and maximum counts so any
 * surface that wants to show a specific number can do so without
 * parsing the message.
 */
export class UserTemplateQuotaError extends Error {
  constructor(
    readonly current: number,
    readonly limit: number,
  ) {
    super(`You've reached the limit of ${limit} saved templates. Delete one to make room.`);
    this.name = 'UserTemplateQuotaError';
  }
}
