import { useEffect, useState } from 'react';
import type { VideoCandidate } from '@core/videos/domain/VideoCandidate';
import type { VideoValidationResult } from '@core/videos/domain/VideoValidationResult';
import type { VideoValidator } from '@core/videos/domain/VideoValidator';

/** What a render knows about a validation in flight. */
export interface VideoValidationState {
  readonly isValidating: boolean;
  /** `null` while validating, with nothing to validate, or when the rules could not be applied. */
  readonly result: VideoValidationResult | null;
}

const IDLE: VideoValidationState = { isValidating: false, result: null };
const VALIDATING: VideoValidationState = { isValidating: true, result: null };

/**
 * Runs the rules over `candidate`, discarding the answer to a
 * candidate that is no longer current. Pass `null` when there is
 * nothing to validate, and `revalidateOn` to re-run when something
 * the rules read changed without the candidate changing.
 *
 * A failed validation leaves `result` null rather than refusing: a
 * preventive check that cannot reach its source has no opinion, and
 * the flow it guards applies the same rules again.
 *
 * `candidate` must be referentially stable — build it with `useMemo`,
 * or every render restarts the validation.
 */
export function useVideoValidation(
  validator: VideoValidator,
  candidate: VideoCandidate | null,
  revalidateOn?: string,
): VideoValidationState {
  const [state, setState] = useState<VideoValidationState>(candidate === null ? IDLE : VALIDATING);

  useEffect(() => {
    if (candidate === null) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    setState(VALIDATING);
    validator.validate(candidate).then(
      (result) => { if (!cancelled) setState({ isValidating: false, result }); },
      () => { if (!cancelled) setState(IDLE); },
    );
    return () => { cancelled = true; };
  }, [validator, candidate, revalidateOn]);

  return state;
}
