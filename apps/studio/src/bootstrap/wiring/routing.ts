import { AppRoutes } from '@core/routing/domain/AppRoutes';

export interface RoutingDependencies {
  /** Path prefix the tree is mounted under; `''` for the root tree. */
  readonly pathPrefix: string;
}

export interface RoutingModule {
  readonly routes: AppRoutes;
}

/** Boots the routing feature: the shared path builder bound to the tree's mount prefix. */
export function bootRouting(deps: RoutingDependencies): RoutingModule {
  return { routes: new AppRoutes(deps.pathPrefix) };
}
