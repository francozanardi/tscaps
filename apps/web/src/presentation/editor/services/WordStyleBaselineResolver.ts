import type { AlignmentConfig } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';

export interface WordPositionBaseline {
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
}

/** Composes the inherited values that a word-level style-override panel falls back to, and the effective alignments used by the overlay layers. */
export class WordStyleBaselineResolver {

  /** Sheet typography and rotation, overlaid with segment-level typography/color/rotation overrides. Excludes position offsets. */
  typographyBaseline(sheet: Sheet, segmentId: string, segmentOverrides: SegmentOverrides): Partial<SegmentStyleOverrides> {
    return {
      ...sheet.typographyConfig,
      rotation: sheet.rotationConfig.angleDeg,
      ...this.stripPositionKeys(segmentOverrides.getStyle(segmentId)),
    };
  }

  /** Sheet alignment merged with any per-segment alignment override. */
  segmentEffectiveAlignment(sheet: Sheet, segmentId: string, segmentOverrides: SegmentOverrides): AlignmentConfig {
    return {
      ...sheet.alignmentConfig,
      ...(segmentOverrides.buildAlignmentOverride(segmentId) ?? {}),
    };
  }

  /** Segment alignment merged with any per-word alignment override. */
  wordEffectiveAlignment(segmentAlignment: AlignmentConfig, wordOverrides: WordStyleOverrideRegistry, wordId: string): AlignmentConfig {
    return {
      ...segmentAlignment,
      ...(wordOverrides.buildAlignmentOverride(wordId) ?? {}),
    };
  }

  /** Measured position when the word is in the live preview; segment offsets otherwise. */
  positionBaseline(alignment: AlignmentConfig, measured: WordPositionBaseline | null): WordPositionBaseline {
    return measured ?? { verticalOffset: alignment.verticalOffset, horizontalOffset: alignment.horizontalOffset };
  }

  private stripPositionKeys(overrides: SegmentStyleOverrides): SegmentStyleOverrides {
    const { verticalOffset: _v, horizontalOffset: _h, ...rest } = overrides;
    return rest;
  }
}
