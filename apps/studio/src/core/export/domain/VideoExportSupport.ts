/**
 * Answers whether this browser can encode a video export at all: is
 * there any codec it can encode that one of the containers the export
 * offers also accepts.
 *
 * The answer depends on the browser alone, never on a particular
 * source video, so it can be asked before any file has been read. It
 * is deliberately coarse — `false` means no combination of format and
 * quality the export dialog offers can produce a file, a dead end no
 * change of settings and no other video recovers from.
 */
export interface VideoExportSupport {
  isSupported(): Promise<boolean>;
}
