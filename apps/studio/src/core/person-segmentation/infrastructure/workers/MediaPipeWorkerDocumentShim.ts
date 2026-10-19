/**
 * Gives a worker the `self.document` MediaPipe probes. When a
 * confidence mask lives on the GPU, reading it back as floats asks
 * `"ontouchend" in self.document` on any Mac user agent, to tell a
 * desktop Mac from an iPad presenting as one, since the two need
 * different readback formats. A worker has no document, so the `in`
 * throws and every mask readback on a Mac fails.
 *
 * The stand-in answers the probe the way a page's document would: it
 * carries `ontouchend` only when the device reports touch points.
 * A real `document`, where one exists, is left alone.
 *
 * `install` must run before the first mask is read.
 */
export class MediaPipeWorkerDocumentShim {

  install(): void {
    const scope = self as { document?: object };
    if (scope.document !== undefined) return;
    scope.document = navigator.maxTouchPoints > 0 ? { ontouchend: null } : {};
  }
}
