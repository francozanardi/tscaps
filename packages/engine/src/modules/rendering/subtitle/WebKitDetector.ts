/**
 * Whether the host renders with WebKit: Safari on macOS, and every
 * browser on iOS and iPadOS, whatever its name, since all of them run
 * WebKit there.
 *
 * Read from `navigator.vendor`, which WebKit reports as
 * `Apple Computer, Inc.` in every one of those browsers, a desktop-mode
 * iPad included, while Chromium reports `Google Inc.` and Firefox an
 * empty string. The answer is fixed for the host, so it is the same on
 * every call.
 */
export class WebKitDetector {

  constructor(private readonly navigator: Pick<Navigator, 'vendor'>) {}

  isWebKit(): boolean {
    return this.navigator.vendor === 'Apple Computer, Inc.';
  }
}
