import type { VerticalResolution, HorizontalResolution } from '@presentation/editor/services/SnapZoneResolver';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import type { DragSession } from '@presentation/editor/controllers/DragSession';

export interface SegmentDragTarget {
  readonly kind: 'segment';
  readonly segmentId: string;
  readonly hitzone: HTMLElement;
  readonly wrapper: HTMLElement;
}

export interface WordDragTarget {
  readonly kind: 'word';
  readonly wordId: string;
  readonly segmentId: string;
  readonly span: HTMLElement;
}

export interface SegmentResizeTarget {
  readonly kind: 'segment-resize';
  readonly segmentId: string;
  readonly corner: ResizeCorner;
  readonly handle: HTMLElement;
}

export interface WordResizeTarget {
  readonly kind: 'word-resize';
  readonly wordId: string;
  readonly corner: ResizeCorner;
  readonly handle: HTMLElement;
}

export interface SegmentRotateTarget {
  readonly kind: 'segment-rotate';
  readonly segmentId: string;
  readonly handle: HTMLElement;
}

export interface WordRotateTarget {
  readonly kind: 'word-rotate';
  readonly wordId: string;
  readonly handle: HTMLElement;
}

export type AnyDragTarget =
  | SegmentDragTarget
  | WordDragTarget
  | SegmentResizeTarget
  | WordResizeTarget
  | SegmentRotateTarget
  | WordRotateTarget;

export interface SegmentDragState {
  readonly kind: 'segment';
  readonly segmentId: string;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly vertical: VerticalResolution;
  readonly horizontal: HorizontalResolution;
  readonly scopedToSegment: boolean;
}

export interface WordDragState {
  readonly kind: 'word';
  readonly wordId: string;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
  readonly horizontalSnap: boolean;
  readonly dropTargetSegmentId: string | null;
}

export interface SegmentResizeState {
  readonly kind: 'segment-resize';
  readonly segmentId: string;
  /** Latest fontSize (in `cqh`) committed during the resize. */
  readonly fontSize: number;
  /** True when writes target the per-segment override instead of the
   *  sheet — latched at pointerdown by the Alt modifier. */
  readonly scopedToSegment: boolean;
}

export interface WordResizeState {
  readonly kind: 'word-resize';
  readonly wordId: string;
  readonly fontSize: number;
}

export interface SegmentRotateState {
  readonly kind: 'segment-rotate';
  readonly segmentId: string;
  /** Latest absolute rotation (degrees) committed during the gesture. */
  readonly rotationDeg: number;
  /** Snap target the value has latched onto (e.g. `45`), or `null`
   *  when the rotation sits outside every snap zone. */
  readonly snappedAngleDeg: number | null;
  /** True when writes target the per-segment override instead of the
   *  sheet — latched at pointerdown by the Alt modifier. */
  readonly scopedToSegment: boolean;
}

export interface WordRotateState {
  readonly kind: 'word-rotate';
  readonly wordId: string;
  readonly rotationDeg: number;
  readonly snappedAngleDeg: number | null;
}

export type OverlayDragState =
  | SegmentDragState
  | WordDragState
  | SegmentResizeState
  | WordResizeState
  | SegmentRotateState
  | WordRotateState;

export interface SegmentBindInput {
  readonly segmentId: string;
  readonly hitzone: HTMLElement;
  readonly wrapper: HTMLElement;
}

export interface WordBindInput {
  readonly wordId: string;
  readonly segmentId: string;
  readonly span: HTMLElement;
}

export interface SegmentResizeBindInput {
  readonly segmentId: string;
  readonly corner: ResizeCorner;
  readonly handle: HTMLElement;
}

export interface WordResizeBindInput {
  readonly wordId: string;
  readonly corner: ResizeCorner;
  readonly handle: HTMLElement;
}

export interface SegmentRotateBindInput {
  readonly segmentId: string;
  readonly handle: HTMLElement;
}

export interface WordRotateBindInput {
  readonly wordId: string;
  readonly handle: HTMLElement;
}

export interface SnapGuide {
  readonly center: number;
}

/** Pixel distance a pointer must move past the down position before
 *  any gesture (drag or resize) flips from "just a click" to "active
 *  gesture". Shared across every gesture so the felt threshold is
 *  uniform. */
export const DRAG_ACTIVATION_THRESHOLD_PX = 3;

/**
 * Narrow protocol every gesture consumes against the
 * `OverlayManipulationController`. Gives gestures read access to the
 * scaler frame and lets them request that a new session take over —
 * the controller stays the sole owner of the active session, so any
 * gating ("is another gesture in flight?") is decided in one place.
 */
export interface OverlayGestureHost {
  scaler(): HTMLElement | null;
  isSessionActive(): boolean;
  activateSession(session: DragSession): void;
}
