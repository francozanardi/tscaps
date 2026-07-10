/**
 * Closed union of every name an `AppError` subclass is allowed to
 * carry on its `name` field. Each concrete error class declares its
 * `name` as a literal in this union, so renames, deletions and new
 * additions surface as compile errors at the dispatch sites that
 * pattern-match on `error.name` (e.g. the shared error renderer).
 *
 * Adding a typed error means appending its name here and setting
 * `readonly name = '<that name>'` on the class. The two must match
 * verbatim; the compiler enforces the link.
 */
export type AppErrorName =
  | 'UnknownAppError'
  | 'ExportFailedError'
  | 'LocalTranscriptionFailedError'
  | 'ProjectDeleteFailedError'
  | 'ProjectExportFailedError'
  | 'ProjectImportFailedError'
  | 'ProjectListLoadFailedError'
  | 'ProjectSaveFailedError'
  | 'PreviewProxyGenerationFailedError'
  | 'UnsupportedVideoCodecError'
  | 'UnsupportedAudioCodecError'
  ;
