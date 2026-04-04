import { IRoute } from 'types/navigation';

// NextJS Requirement
export const isWindowAvailable = () => typeof window !== 'undefined';

export const findCurrentRoute = (routes: IRoute[]): IRoute | undefined => {
  if (!isWindowAvailable()) {
    return undefined;
  }

  const currentPath = window.location.pathname;
  return routes.find((route) => currentPath.startsWith(route.layout + route.path));
};

export const getActiveRoute = (routes: IRoute[]): string => {
  const route = findCurrentRoute(routes);
  return route?.name || 'Default Brand Text';
};

export const getActiveNavbar = (routes: IRoute[]): boolean => {
  const route = findCurrentRoute(routes);
  return route?.secondary;
};

export const getActiveNavbarText = (routes: IRoute[]): string | boolean => {
  return getActiveRoute(routes) || false;
};
