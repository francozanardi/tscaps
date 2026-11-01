import { describe, expect, it } from 'vitest';
import { WebKitDetector } from '@modules/rendering/subtitle/WebKitDetector';

describe('WebKitDetector', () => {
  it.each([
    ['Safari, or any browser on iOS', 'Apple Computer, Inc.', true],
    ['Chromium', 'Google Inc.', false],
    ['Firefox', '', false],
  ])('answers for %s, whose vendor is %j', (_name, vendor, expected) => {
    expect(new WebKitDetector({ vendor }).isWebKit()).toBe(expected);
  });
});
