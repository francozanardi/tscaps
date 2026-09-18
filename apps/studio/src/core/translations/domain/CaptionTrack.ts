import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

export const ORIGINAL_CAPTION_TRACK_ID = 'original';
export const MAX_TRANSLATIONS_PER_PROJECT = 5;

export interface CaptionTrackProps {
  readonly id: string;
  readonly name: string;
  readonly kind: 'original' | 'translation';
  readonly sourceTrackId: string | null;
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly activeSheetId: string | null;
  readonly behindActorOverrides: BehindActorSegmentOverrideRegistry;
  readonly frozenSegments: FrozenSegmentSet;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;
}

/**
 * One independently editable caption document and its Studio-owned visual
 * state. The engine still sees only the enclosed Document and its opaque
 * Section kinds; Sheet resolution remains entirely in Studio.
 */
export class CaptionTrack {
  readonly id: string;
  readonly name: string;
  readonly kind: 'original' | 'translation';
  readonly sourceTrackId: string | null;
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly activeSheetId: string | null;
  readonly behindActorOverrides: BehindActorSegmentOverrideRegistry;
  readonly frozenSegments: FrozenSegmentSet;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;

  constructor(props: CaptionTrackProps) {
    this.id = props.id;
    this.name = props.name;
    this.kind = props.kind;
    this.sourceTrackId = props.sourceTrackId;
    this.document = props.document;
    this.sheets = props.sheets;
    this.activeSheetId = props.activeSheetId;
    this.behindActorOverrides = props.behindActorOverrides;
    this.frozenSegments = props.frozenSegments;
    this.elementStyles = props.elementStyles;
    this.decorationOverrides = props.decorationOverrides;
  }

  with(changes: Partial<CaptionTrackProps>): CaptionTrack {
    return new CaptionTrack({
      id: this.id,
      name: this.name,
      kind: this.kind,
      sourceTrackId: this.sourceTrackId,
      document: this.document,
      sheets: this.sheets,
      activeSheetId: this.activeSheetId,
      behindActorOverrides: this.behindActorOverrides,
      frozenSegments: this.frozenSegments,
      elementStyles: this.elementStyles,
      decorationOverrides: this.decorationOverrides,
      ...changes,
    });
  }
}
