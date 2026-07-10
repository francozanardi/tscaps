/**
 * Thrown when the repository refuses a font upload because a blob
 * with the same family already exists. `family` is the normalised
 * name reported by the repository.
 */
export class UserBlobDuplicateFamilyError extends Error {
  constructor(readonly family: string) {
    super(`Font family already exists: ${family}`);
    this.name = 'UserBlobDuplicateFamilyError';
  }
}
