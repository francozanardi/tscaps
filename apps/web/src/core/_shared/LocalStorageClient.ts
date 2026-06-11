/**
 * `window.localStorage` wrapped with JSON encoding, a key namespace, and
 * silent error handling — storage may be unavailable (private mode,
 * quota, blocked cookies); reads return `null` instead of throwing so
 * callers can fall back to defaults.
 */
export class LocalStorageClient {

  constructor(private readonly namespace: string) {}

  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(this.scopedKey(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(this.scopedKey(key), JSON.stringify(value));
    } catch { /* storage unavailable */ }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(this.scopedKey(key));
    } catch { /* storage unavailable */ }
  }

  private scopedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
