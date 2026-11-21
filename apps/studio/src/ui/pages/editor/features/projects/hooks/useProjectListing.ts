import { useEffect, useReducer } from 'react';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import {
  ProjectListingBuilder,
  type ProjectListing,
} from '@presentation/projects/services/ProjectListingBuilder';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';

const PROJECT_LISTING = new ProjectListingBuilder();

/**
 * Splits `stored` between the projects runs in this tab are still
 * working on and the rest (`ProjectListingBuilder`). Read on every
 * render, so it follows the runs as they move, and rendered again
 * whenever a run starts or ends and whenever a run's progress moves.
 * `null` while `stored` is.
 */
export function useProjectListing(stored: readonly ProjectMetadata[] | null): ProjectListing | null {
  const { runsStore } = usePreprocessing();
  const [, rerender] = useReducer((renders: number) => renders + 1, 0);
  const runs = runsStore.runs;

  useEffect(() => {
    runsStore.addEventListener('change', rerender);
    return () => runsStore.removeEventListener('change', rerender);
  }, [runsStore]);

  useEffect(() => {
    for (const run of runs) run.progress.addEventListener('change', rerender);
    return () => {
      for (const run of runs) run.progress.removeEventListener('change', rerender);
    };
  }, [runs]);

  return stored ? PROJECT_LISTING.build(runs, stored) : null;
}
