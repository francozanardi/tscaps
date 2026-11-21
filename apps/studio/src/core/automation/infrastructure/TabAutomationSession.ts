const STORAGE_KEY = 'tscaps.automation-session';
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * The token of the automation session this tab was opened for: the
 * `automation` query parameter a program puts on the URL it opens, kept
 * for the tab in session storage, so the page still answers the program
 * after it moved to another route and is reloaded (the query is gone by
 * then). Read once, at boot. Null on an ordinary visit.
 */
export class TabAutomationSession {
  private readonly value: string | null = this.read();

  token(): string | null {
    return this.value !== null && TOKEN_FORMAT.test(this.value) ? this.value : null;
  }

  private read(): string | null {
    const given = new URLSearchParams(window.location.search).get('automation');
    try {
      if (given !== null && TOKEN_FORMAT.test(given)) window.sessionStorage.setItem(STORAGE_KEY, given);
      return given ?? window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage refused (a private window, blocked site data): the query alone still opens the session; only a reload
      // after leaving the first route loses it.
      return given;
    }
  }
}
