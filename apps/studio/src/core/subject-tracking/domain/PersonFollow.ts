import type { FollowPlan } from '@core/subject-tracking/domain/FollowPlan';
import type { TrackedHead } from '@core/subject-tracking/domain/TrackedHead';

/**
 * A person followed through a stretch: where their head was in every
 * frame they were found in, in time order, which is what to keep, and
 * how a crop of the size asked for follows them, which can be planned
 * again from the heads for a crop of another size.
 */
export interface PersonFollow {
  readonly heads: ReadonlyArray<TrackedHead>;
  readonly plan: FollowPlan;
}
