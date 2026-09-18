/**
 * Raised when a request for a model file never produced a response:
 * the host could not be resolved or connected to, the connection was
 * refused or cut, or something between the runtime and the host
 * dropped it.
 *
 * It covers the transport only. A host that answers is a success as
 * far as this error is concerned, whatever the status code it
 * answered with, because a refusal carrying a status is a different
 * situation with a different remedy.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a Worker
 * boundary (where structured cloning preserves the string fields but
 * not the class identity) with a single source of truth.
 */
export class ModelFileRequestFailedError extends Error {
  static readonly ERROR_NAME = 'ModelFileRequestFailedError';
  readonly name = ModelFileRequestFailedError.ERROR_NAME;
}
