import type { AppRoutes } from '@core/routing/domain/AppRoutes';
import { useRouting } from '@ui/_shared/contexts/modules/RoutingContext';

/** Returns the `AppRoutes` of the active tree. */
export function useAppRoutes(): AppRoutes {
  return useRouting().routes;
}
