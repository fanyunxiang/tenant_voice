import { IRoute } from 'types/navigation';

// NextJS Requirement
export const isWindowAvailable = () => typeof window !== 'undefined';

export const findCurrentRoute = (
  routes: IRoute[],
  currentPath?: string | null,
): IRoute | undefined => {
  if (!currentPath && !isWindowAvailable()) {
    return undefined;
  }

  const activePath = currentPath ?? window.location.pathname;
  return routes.find((route) => activePath.startsWith(route.layout + route.path));
};

export const getActiveRoute = (routes: IRoute[], currentPath?: string | null): string => {
  const route = findCurrentRoute(routes, currentPath);
  return route?.name || 'Default Brand Text';
};

export const getActiveNavbar = (routes: IRoute[], currentPath?: string | null): boolean => {
  const route = findCurrentRoute(routes, currentPath);
  return route?.secondary ?? false;
};

export const getActiveNavbarText = (
  routes: IRoute[],
  currentPath?: string | null,
): string | boolean => {
  return getActiveRoute(routes, currentPath) || false;
};
