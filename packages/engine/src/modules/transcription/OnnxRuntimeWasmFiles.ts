/**
 * The two files the inference runtime's WebAssembly backend loads: the
 * binary and the glue module that instantiates it. Both are served to
 * the runtime as URLs.
 *
 * They come from the consumer because only the consumer knows where
 * its build put them, and they have to match: the glue module is
 * generated alongside one specific binary and cannot instantiate
 * another. The runtime ships more than one such pair, and which one a
 * browser needs is a property of that browser, so the choice is made
 * where the browser is already known.
 */
export interface OnnxRuntimeWasmFiles {
  readonly mjs: string;
  readonly wasm: string;
}
