/**
 * Restores a working `importScripts` inside a module worker. Module
 * workers expose the function but calling it throws (`Module scripts
 * don't support importScripts()`), and MediaPipe's WASM loader relies
 * on it to evaluate its classic glue script — the glue declares
 * `var ModuleFactory` and expects it to land on the worker's global
 * scope, where the loader reads it back.
 *
 * The shim fetches each script with a synchronous request (allowed in
 * workers) and evaluates it through indirect eval, which runs the text
 * at global scope in sloppy mode — the exact semantics of a classic
 * script, so top-level `var` declarations become globals.
 *
 * `install` must run before any code path that calls `importScripts`.
 */
export class ModuleWorkerImportScriptsShim {

  install(): void {
    (self as { importScripts?: (...urls: string[]) => void }).importScripts = (...urls: string[]): void => {
      for (const url of urls) this.evaluateClassicScript(url);
    };
  }

  private evaluateClassicScript(url: string): void {
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send();
    if (request.status < 200 || request.status >= 300) {
      throw new Error(`Failed to load script ${url}: HTTP ${request.status}`);
    }
    // Indirect eval is the mechanism, not a shortcut: classic scripts
    // evaluate at global scope, and the loaded script is version-pinned
    // CDN code the worker would have run via importScripts anyway.
    (0, eval)(request.responseText);
  }
}
