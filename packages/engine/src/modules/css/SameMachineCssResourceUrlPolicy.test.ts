import { describe, expect, it } from 'vitest';
import { SameMachineCssResourceUrlPolicy } from '@modules/css/SameMachineCssResourceUrlPolicy';

/**
 * What a host rendering somebody else's stylesheet is willing to
 * fetch.
 *
 * The refusals are the point: each one is an outbound request this
 * machine would otherwise make to an address a caller chose, with the
 * response folded back into the frame they receive.
 */
const policy = new SameMachineCssResourceUrlPolicy('http://127.0.0.1:4321');

describe('SameMachineCssResourceUrlPolicy', () => {
  it.each([
    ['a blob the page itself holds', 'blob:http://127.0.0.1:4321/9f2c-uuid'],
    ['an asset served beside the page', '/assets/marker-stroke.png'],
    ['the same asset spelled absolutely', 'http://127.0.0.1:4321/assets/marker-stroke.png'],
    // Nonsense, but nonsense that resolves to a path beside the page:
    // looking for it and getting a 404 never leaves the machine.
    ['a relative path that names nothing', 'not a url'],
  ])('fetches %s', (_case, url) => {
    expect(policy.allows(url)).toBe(true);
  });

  it.each([
    ['a host on the open web', 'https://example.test/font.woff2'],
    ['the address a machine asks its host for credentials on', 'http://169.254.169.254/latest/meta-data/'],
    ['a neighbour on the private network', 'http://10.0.0.5/internal'],
    ['the same machine on another port', 'http://127.0.0.1:9000/other'],
    ['a protocol-relative address', '//example.test/font.woff2'],
    ['a scheme with no origin at all', 'javascript:fetch("http://example.test")'],
    ['the local filesystem', 'file:///etc/passwd'],
  ])('refuses %s', (_case, url) => {
    expect(policy.allows(url)).toBe(false);
  });
});
