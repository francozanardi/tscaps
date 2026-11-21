/**
 * How close two output times are to count as one, in seconds. Mapping
 * source time through the cuts subtracts their lengths one by one, so a
 * stretch cut away whole can come out a hair long rather than empty;
 * anything shorter than this plays nothing.
 */
export const OUTPUT_TIME_TOLERANCE_SEC = 1e-6;
