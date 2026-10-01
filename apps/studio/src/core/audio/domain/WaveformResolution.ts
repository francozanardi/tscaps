/**
 * How finely the editor reads a waveform: one peak per 10 ms. Shared by
 * everything that asks for one, so an envelope worked out for one purpose
 * is the very envelope another asks for.
 */
export const WAVEFORM_PEAKS_PER_SECOND = 100;
