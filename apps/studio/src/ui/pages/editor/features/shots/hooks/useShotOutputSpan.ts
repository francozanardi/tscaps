import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { OUTPUT_TIME_TOLERANCE_SEC } from '@core/cuts/domain/OutputTimeTolerance';

export interface ShotOutputSpan {
  readonly startSec: number;
  readonly endSec: number;
  readonly durationSec: number;
  /** Whether cuts leave nothing of it in the output. */
  readonly isCutAway: boolean;
}

/** A shot's extent as the output plays it, once cuts collapse; the shot itself is held in source time. */
export function useShotOutputSpan(sourceStartSec: number, sourceEndSec: number): ShotOutputSpan {
  const timeMap = useRenderTimeMap();
  const startSec = timeMap.toOutputTime(sourceStartSec);
  const endSec = timeMap.toOutputTime(sourceEndSec);
  const durationSec = Math.max(0, endSec - startSec);
  return { startSec, endSec, durationSec, isCutAway: durationSec < OUTPUT_TIME_TOLERANCE_SEC };
}
