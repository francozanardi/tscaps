import { describe, expect, it } from 'vitest';
import { CssSupportsWebKitReleaseDetector } from '@core/browser-support/infrastructure/CssSupportsWebKitReleaseDetector';

function detectorSupporting(...supported: string[]): CssSupportsWebKitReleaseDetector {
  return new CssSupportsWebKitReleaseDetector({
    supports: (conditionText) => supported.some((property) => conditionText.startsWith(`${property}:`)),
  });
}

describe('CssSupportsWebKitReleaseDetector', () => {
  it('takes a WebKit that parses none of the CSS 26 introduced for one older than 26', () => {
    expect(detectorSupporting().isBefore26()).toBe(true);
  });

  it('takes a WebKit that parses any of it for 26 or later', () => {
    expect(detectorSupporting('anchor-name').isBefore26()).toBe(false);
    expect(detectorSupporting('color').isBefore26()).toBe(false);
    expect(detectorSupporting('anchor-name', 'color').isBefore26()).toBe(false);
  });
});
