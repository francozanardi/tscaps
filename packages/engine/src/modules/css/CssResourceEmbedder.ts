export interface CssResourceEmbedder {
  embed(css: string): Promise<string>;
}
