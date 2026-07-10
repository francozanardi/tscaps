/**
 * Signals whether the current page load is running under the e2e test
 * harness. The harness marks its entry URL with the `?e2e=1` query
 * parameter; every branch that needs to react to it — the composition
 * root wiring the runtime hook, the "no video → dashboard" router
 * guard bypass, and future consumers — reads through this class so the
 * URL contract lives in one place.
 */
export class E2EMode {
  isEnabled(): boolean {
    return new URLSearchParams(window.location.search).get('e2e') === '1';
  }
}
