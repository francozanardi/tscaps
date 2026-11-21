import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { PersonSightingModelLocations } from '@core/subject-tracking/infrastructure/PersonSightingModelLocations';

/** Messages the main thread sends the sighting worker, each with a `requestId` its reply carries back. */
export type PersonSightingWorkerInbound = SightingInitRequest | SightRequest;

export interface SightingInitRequest {
  readonly type: 'init';
  readonly requestId: number;
  readonly locations: PersonSightingModelLocations;
  /** Whether the models may run on the GPU; false keeps them on the CPU. */
  readonly onGpu: boolean;
}

export interface SightRequest {
  readonly type: 'sight';
  readonly requestId: number;
  readonly bitmap: ImageBitmap;
}

/**
 * Messages the sighting worker sends back; `error` fails the request it
 * names, and `lost` says the models lost their GPU context, after which
 * the worker answers nothing more.
 */
export type PersonSightingWorkerOutbound = SightingAckReply | SightedReply | SightingErrorReply | SightingLostReply;

export interface SightingAckReply {
  readonly type: 'ack';
  readonly requestId: number;
}

export interface SightedReply {
  readonly type: 'sighted';
  readonly requestId: number;
  readonly people: ReadonlyArray<PersonSighting>;
}

export interface SightingErrorReply {
  readonly type: 'error';
  readonly requestId: number;
  readonly message: string;
}

export interface SightingLostReply {
  readonly type: 'lost';
  readonly requestId: number;
}
