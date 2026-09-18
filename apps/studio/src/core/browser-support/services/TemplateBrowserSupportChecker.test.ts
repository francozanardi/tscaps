import { describe, expect, it } from 'vitest';
import { UserAgentInspector } from '@shared/browser';
import type { DeclarableBrowser } from '@core/browser-support/domain/DeclarableBrowser';
import type { Template } from '@core/templates/domain/Template';
import { TemplateBrowserSupportChecker } from '@core/browser-support/services/TemplateBrowserSupportChecker';

const USER_AGENTS = {
  chrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeOnIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  firefoxOnIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
};

function templateRefusing(...browsers: DeclarableBrowser[]): Template {
  return { metadata: { unsupportedBrowsers: browsers } } as unknown as Template;
}

function checkerOn(userAgent: string): TemplateBrowserSupportChecker {
  return new TemplateBrowserSupportChecker(new UserAgentInspector(userAgent));
}

describe('TemplateBrowserSupportChecker', () => {

  it('supports a template that refuses nothing, everywhere', () => {
    for (const userAgent of Object.values(USER_AGENTS)) {
      expect(checkerOn(userAgent).isSupported(templateRefusing())).toBe(true);
    }
  });

  it('refuses a template in the browser it names', () => {
    expect(checkerOn(USER_AGENTS.firefox).isSupported(templateRefusing('firefox'))).toBe(false);
    expect(checkerOn(USER_AGENTS.safari).isSupported(templateRefusing('safari'))).toBe(false);
  });

  // The bug this class was rewritten for: every Chromium user agent ends
  // in a `Safari/<version>` token, so matching the declared name as a
  // substring of the raw user agent disabled a Safari-only template in
  // Chrome, Edge, Brave and Arc — silently, and in the browsers where it
  // was the whole point that it worked.
  it('keeps a Safari-only refusal out of Chromium browsers', () => {
    expect(checkerOn(USER_AGENTS.chrome).isSupported(templateRefusing('safari'))).toBe(true);
    expect(checkerOn(USER_AGENTS.edge).isSupported(templateRefusing('safari'))).toBe(true);
  });

  // Every browser on iOS paints with WebKit, so a template that renders
  // wrong in Safari renders wrong in all of them. Neither user agent
  // spells its brand the way the desktop one does — `CriOS`, `FxiOS` —
  // which is what makes them resolve to Safari rather than to Chrome or
  // Firefox.
  it('reads every iOS browser as Safari', () => {
    const webkitOnly = templateRefusing('safari');
    expect(checkerOn(USER_AGENTS.chromeOnIos).isSupported(webkitOnly)).toBe(false);
    expect(checkerOn(USER_AGENTS.firefoxOnIos).isSupported(webkitOnly)).toBe(false);
  });

  it('does not refuse iOS Firefox for a Gecko-only refusal', () => {
    expect(checkerOn(USER_AGENTS.firefoxOnIos).isSupported(templateRefusing('firefox'))).toBe(true);
  });

  it('supports a template whose refusals name other browsers', () => {
    expect(checkerOn(USER_AGENTS.chrome).isSupported(templateRefusing('firefox', 'safari'))).toBe(true);
  });
});
