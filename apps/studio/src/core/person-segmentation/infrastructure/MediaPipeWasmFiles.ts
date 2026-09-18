/**
 * The two files MediaPipe's runtime loads: the loader script and the
 * binary it instantiates. They are a matched pair and cannot be mixed
 * between builds.
 *
 * MediaPipe can find them itself, but only in a directory where they
 * still carry their published names. A bundler that fingerprints
 * assets renames them, which is the case its manual fileset exists
 * for, so both paths are named here instead of a directory to look in.
 */
export interface MediaPipeWasmFiles {
  readonly loaderUrl: string;
  readonly binaryUrl: string;
}
