import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ShotFollowFlowController, type ShotFollowFlowState } from '@presentation/shots/controllers/ShotFollowFlowController';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useSubjectTracking } from '@ui/_shared/contexts/modules/SubjectTrackingContext';

/**
 * Picking a person for the shot `shotId` to follow, and where it has
 * got; stopped, without a word, once the shot is no longer shown.
 */
export function useShotFollowFlow(shotId: string): { flow: ShotFollowFlowController; state: ShotFollowFlowState } {
  const { actions } = useShots();
  const subjectTracking = useSubjectTracking();
  const flow = useMemo(
    () => new ShotFollowFlowController(shotId, subjectTracking.actions.findPeople, actions.followPerson),
    [shotId, subjectTracking, actions],
  );
  useEffect(() => () => flow.stop(), [flow]);
  const state = useSyncExternalStore(
    (onChange) => {
      flow.addEventListener('change', onChange);
      return () => flow.removeEventListener('change', onChange);
    },
    () => flow.snapshot(),
  );
  return { flow, state };
}
