import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';
import type { CssResourceUrlPolicy } from '@modules/css/CssResourceUrlPolicy';

/**
 * Inlines every resource a stylesheet references as a `data:` URI, so
 * the CSS survives being rasterized through an SVG decoded as an image
 * — which loads nothing external by itself.
 *
 * `policy` decides which references are fetched at all. It is a
 * constructor parameter and not a default because the answer belongs
 * to the host: a person's own browser may fetch anywhere, and a
 * machine rendering a stylesheet somebody else wrote may not.
 */
export class BrowserCssResourceEmbedder implements CssResourceEmbedder {
  constructor(private readonly policy: CssResourceUrlPolicy) {}

  async embed(css: string): Promise<string> {
    const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    const matches = [...css.matchAll(urlRegex)];
    
    // Extract unique URLs, ignoring those already embedded as data: URIs
    // and same-document fragment refs like url(#filter-id), which point
    // at sibling <defs> inside the host SVG and must be left intact.
    const allUrls = matches.map((m) => m[2]);
    const validUrls = allUrls.filter((url): url is string => Boolean(url) && !url!.startsWith('data:') && !url!.startsWith('#'));
    // Left in the CSS rather than removed: an address this host will
    // not fetch resolves to nothing when the SVG is decoded, which is
    // what a resource that failed to load does too.
    const fetchable = validUrls.filter((url) => {
      if (this.policy.allows(url)) return true;
      console.warn(`BrowserCssResourceEmbedder skipped a resource this host does not fetch: ${url}`);
      return false;
    });
    const uniqueUrls = [...new Set(fetchable)];
    
    const replacements = new Map<string, string>();
    
    await Promise.all(uniqueUrls.map(async (url) => {
      try {
        const response = await window.fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve(reader.result as string);
           reader.onerror = reject;
           reader.readAsDataURL(blob);
        });
        replacements.set(url, dataUrl);
      } catch (e) {
        console.warn(`BrowserCssResourceEmbedder failed to embed resource: ${url}`, e);
      }
    }));

    let result = css;
    for (const match of matches) {
      const url = match[2];
      if (url && replacements.has(url)) {
        const newUrl = replacements.get(url)!;
        result = result.replace(match[0], `url("${newUrl}")`);
      }
    }

    return result;
  }
}
