import type { ExportResolution } from '@core/export/actions/ExportVideoAction';

export interface ResolutionOption {
  readonly id: string;
  /** Long-form label for the select dropdown ("FHD (1080p)"). */
  readonly label: string;
  /** Short tag for badges and inline summaries ("FHD" or "800×600" when no tier matches). */
  readonly shortLabel: string;
  readonly resolution: ExportResolution;
}

export interface ResolutionCatalog {
  readonly defaultResolution: ExportResolution;
  readonly options: ResolutionOption[];
}

interface Tier {
  readonly shortSide: number;
  readonly tag: string;
}

/**
 * Resolves the resolution choices the export dialog offers for a given
 * source. Presets are short-side targets (480/720/1080/1440/2160) mapped
 * back to `{width, height}` while preserving the source aspect ratio;
 * presets at-or-above the source short side are filtered out — the
 * renderer never upscales.
 *
 * Vertical sources whose short side exceeds 1080 (typically 4K phone
 * footage destined for social media) default to a 1080p export rather
 * than `'original'`. Avoids accidentally producing 100+ MB files that
 * get re-encoded by the target platform anyway.
 */
export class ExportResolutionPresets {

  private static readonly TIERS: ReadonlyArray<Tier> = [
    { shortSide: 2160, tag: '4K' },
    { shortSide: 1440, tag: 'QHD' },
    { shortSide: 1080, tag: 'FHD' },
    { shortSide: 720, tag: 'HD' },
    { shortSide: 480, tag: 'SD' },
  ];

  private static readonly VERTICAL_DEFAULT_CAP = 1080;

  forInput(width: number, height: number): ResolutionCatalog {
    const sourceShortSide = Math.min(width, height);
    const isVertical = height > width;

    const original: ResolutionOption = {
      id: 'original',
      label: this.buildOriginalLabel(width, height, sourceShortSide),
      shortLabel: this.shortLabelFor(sourceShortSide, width, height),
      resolution: 'original',
    };

    const presets: ResolutionOption[] = [];
    for (const tier of ExportResolutionPresets.TIERS) {
      if (tier.shortSide >= sourceShortSide) continue;
      const target = this.scaleToShortSide(width, height, tier.shortSide);
      presets.push({
        id: this.idFor(target),
        label: `${tier.tag} (${tier.shortSide}p)`,
        shortLabel: tier.tag,
        resolution: target,
      });
    }

    const defaultResolution: ExportResolution =
      isVertical && sourceShortSide > ExportResolutionPresets.VERTICAL_DEFAULT_CAP
        ? this.scaleToShortSide(width, height, ExportResolutionPresets.VERTICAL_DEFAULT_CAP)
        : 'original';

    return { defaultResolution, options: [original, ...presets] };
  }

  /**
   * `true` when the resolved default differs from `'original'` — i.e.
   * the catalog steered the export away from the source resolution.
   * Lets the UI surface a small hint explaining why.
   */
  isVerticalDownscaleDefault(width: number, height: number): boolean {
    const shortSide = Math.min(width, height);
    return height > width && shortSide > ExportResolutionPresets.VERTICAL_DEFAULT_CAP;
  }

  /**
   * Friendly tag for the given pair of dimensions: a tier acronym
   * (`'4K'`, `'FHD'`, …) when the short side matches a standard tier
   * exactly, otherwise a compact `WIDTH×HEIGHT` string.
   */
  shortLabelFor(shortSide: number, width: number, height: number): string {
    const tag = this.tagForShortSide(shortSide);
    return tag ?? `${width}×${height}`;
  }

  /**
   * Long-form description for the given dimensions, e.g.
   * `'FHD · 1920 × 1080'` or `'800 × 600'` when no tier matches.
   * Used to label inputs that don't offer a real choice (the source
   * has no smaller preset, so there's nothing to pick).
   */
  describe(width: number, height: number): string {
    const tag = this.tagForShortSide(Math.min(width, height));
    const dims = `${width} × ${height}`;
    return tag ? `${tag} · ${dims}` : dims;
  }

  private buildOriginalLabel(width: number, height: number, shortSide: number): string {
    const tag = this.tagForShortSide(shortSide);
    const dims = `${width} × ${height}`;
    return tag ? `Keep original (${tag} · ${dims})` : `Keep original (${dims})`;
  }

  private tagForShortSide(shortSide: number): string | null {
    for (const tier of ExportResolutionPresets.TIERS) {
      if (tier.shortSide === shortSide) return tier.tag;
    }
    return null;
  }

  private idFor(resolution: { width: number; height: number }): string {
    return `${resolution.width}x${resolution.height}`;
  }

  private scaleToShortSide(
    width: number,
    height: number,
    targetShortSide: number,
  ): { width: number; height: number } {
    const shortSide = Math.min(width, height);
    const scale = targetShortSide / shortSide;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }
}
