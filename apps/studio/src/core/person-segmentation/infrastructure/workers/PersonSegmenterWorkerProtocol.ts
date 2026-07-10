import type { PoseLandmark } from '@core/person-segmentation/domain/PoseLandmark';

/**
 * Wire messages the main thread sends to the person-segmenter worker.
 * Each carries a `requestId` so the sender can match the reply to the
 * originating call.
 */
export type PersonSegmenterWorkerInbound =
  | InitRequest
  | DetectPoseRequest
  | SegmentPersonRequest;

export interface InitRequest {
  readonly type: 'init';
  readonly requestId: number;
  readonly wasmPath: string;
  readonly poseModelUrl: string;
  readonly segmenterModelUrl: string;
  readonly maskMaxSide: number;
}

export interface DetectPoseRequest {
  readonly type: 'detect-pose';
  readonly requestId: number;
  readonly bitmap: ImageBitmap;
  readonly timestampMs: number;
}

export interface SegmentPersonRequest {
  readonly type: 'segment-person';
  readonly requestId: number;
  readonly bitmap: ImageBitmap;
  readonly timestampMs: number;
  readonly timestampSec: number;
}

/**
 * Wire messages the worker sends back to the main thread. `requestId`
 * matches an inbound message; `error` is emitted for any failure and
 * fails the corresponding pending promise.
 */
export type PersonSegmenterWorkerOutbound =
  | AckReply
  | PoseReply
  | MaskReply
  | ErrorReply;

export interface AckReply {
  readonly type: 'ack';
  readonly requestId: number;
}

export interface PoseReply {
  readonly type: 'pose';
  readonly requestId: number;
  readonly landmarks: ReadonlyArray<PoseLandmark>;
}

export interface MaskReply {
  readonly type: 'mask';
  readonly requestId: number;
  readonly timestamp: number;
  readonly alpha: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface ErrorReply {
  readonly type: 'error';
  readonly requestId: number;
  readonly message: string;
}
