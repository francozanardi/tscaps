import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';

/**
 * Observable list of the user's saved templates. Reads through
 * `snapshot()`; writes through `setUserTemplates`. Pure state — the
 * save and delete actions own the IO and push the new snapshot here so
 * the UI stays in lockstep with persistence.
 */
export class UserTemplatesStore extends EventTarget {
  private _userTemplates: readonly UserTemplate[];
  private readonly _changeEvent = new Event('change');

  constructor(initial: readonly UserTemplate[]) {
    super();
    this._userTemplates = initial;
  }

  snapshot(): readonly UserTemplate[] {
    return this._userTemplates;
  }

  setUserTemplates(userTemplates: readonly UserTemplate[]): void {
    this._userTemplates = userTemplates;
    this.dispatchEvent(this._changeEvent);
  }
}
