export interface DecodedFramePayload {
  readonly bitmap: ImageBitmap;
  readonly timestampSec: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type ClientToWorkerMessage =
  | {
    readonly type: 'open';
    readonly blob: Blob;
    readonly targetWidthPx: number;
    readonly targetHeightPx: number;
  }
  | { readonly type: 'stream-start'; readonly streamId: number; readonly startSourceSec: number }
  | { readonly type: 'stream-request-next'; readonly streamId: number }
  | { readonly type: 'stream-stop'; readonly streamId: number }
  | { readonly type: 'frame-at'; readonly requestId: number; readonly sourceSec: number }
  | { readonly type: 'scrub-start'; readonly scrubId: number }
  | { readonly type: 'scrub-to'; readonly scrubId: number; readonly sourceSec: number }
  | { readonly type: 'scrub-request-next'; readonly scrubId: number }
  | { readonly type: 'scrub-close'; readonly scrubId: number };

export type WorkerToClientMessage =
  | {
    readonly type: 'opened';
    readonly widthPx: number;
    readonly heightPx: number;
    readonly durationSec: number;
    readonly videoCodec: string;
  }
  | { readonly type: 'open-failed'; readonly message: string }
  | {
    readonly type: 'stream-frame';
    readonly streamId: number;
    readonly frame: DecodedFramePayload;
  }
  | { readonly type: 'stream-end'; readonly streamId: number }
  | { readonly type: 'stream-error'; readonly streamId: number; readonly message: string }
  | {
    readonly type: 'frame-response';
    readonly requestId: number;
    readonly frame: DecodedFramePayload | null;
  }
  | { readonly type: 'frame-error'; readonly requestId: number; readonly message: string }
  | {
    readonly type: 'scrub-frame';
    readonly scrubId: number;
    readonly frame: DecodedFramePayload;
  }
  | { readonly type: 'scrub-closed'; readonly scrubId: number };
