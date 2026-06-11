import type { CssResourceEmbedder } from '@modules/css/CssResourceEmbedder';

export class BrowserCssResourceEmbedder implements CssResourceEmbedder {
  async embed(css: string): Promise<string> {
    const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
    const matches = [...css.matchAll(urlRegex)];
    
    // Extract unique URLs, ignoring those already embedded as data: URIs
    // and same-document fragment refs like url(#filter-id), which point
    // at sibling <defs> inside the host SVG and must be left intact.
    const allUrls = matches.map((m) => m[2]);
    const validUrls = allUrls.filter((url): url is string => Boolean(url) && !url!.startsWith('data:') && !url!.startsWith('#'));
    const uniqueUrls = [...new Set(validUrls)];
    
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
