import type { Route } from './Routes';

export const matchRoute = (currentPath: string, routes: Route[]) => {
  // Find the first matching route
  const matchedRoute = routes.find((route) => {
    // Normalize paths to handle trailing slashes consistently
    const normalizedCurrentPath = currentPath.endsWith('/') && currentPath !== '/' ? currentPath.slice(0, -1) : currentPath;
    const normalizedRoutePath = route.path.endsWith('/') && route.path !== '/' ? route.path.slice(0, -1) : route.path;

    // For exact matches, compare normalized paths directly
    if (route.exact) return normalizedCurrentPath === normalizedRoutePath;

    // For routes with wildcards (e.g., /user/*)
    if (route.path.includes('*')) {
      const wildcardIndex = normalizedRoutePath.indexOf('*');
      const routePrefix = normalizedRoutePath.substring(0, wildcardIndex - 1); // -1 to exclude the trailing slash
      return normalizedCurrentPath === routePrefix || normalizedCurrentPath.startsWith(routePrefix + '/');
    }

    // For routes with parameters (e.g., /blog/:id) or optional parameters (e.g., /blog/:id?)
    if (route.path.includes(':')) {
      const routeParts = normalizedRoutePath.split('/').filter(Boolean);
      const pathParts = normalizedCurrentPath.split('/').filter(Boolean);

      // Check if there are optional parameters
      const hasOptionalParams = routeParts.some((part) => part.endsWith('?'));

      // If no optional parameters, segment count must match
      if (!hasOptionalParams && routeParts.length !== pathParts.length) return false;

      // If there are optional parameters, the path parts can't be more than route parts
      if (hasOptionalParams && pathParts.length > routeParts.length) return false;

      // Check each segment
      let pathIndex = 0;
      for (let routeIndex = 0; routeIndex < routeParts.length; routeIndex++) {
        const routePart = routeParts[routeIndex];
        const pathPart = pathParts[pathIndex];

        // Handle optional parameter
        if (routePart.endsWith('?')) {
          // If this is an optional param and we've run out of path parts, it's still a match
          if (pathPart === undefined) continue;

          // Otherwise, treat it as a regular param but increment path index only if we have a path part
          pathIndex++;
          continue;
        }

        // Handle regular parameter or exact match
        if (routePart.startsWith(':') || routePart === pathPart) {
          pathIndex++;
          continue;
        }

        // No match
        return false;
      }

      // Match if we've consumed all path parts
      return pathIndex === pathParts.length;
    }

    // For regular routes, check if the current path matches exactly or is a direct parent path
    // This prevents partial matches like /bluesky/tools matching /bluesky/tools/feed/extra/parts
    const routeParts = normalizedRoutePath.split('/').filter(Boolean);
    const pathParts = normalizedCurrentPath.split('/').filter(Boolean);

    // If the route has more parts than the current path, it can't match
    if (routeParts.length > pathParts.length) return false;

    // If the route has fewer parts than the current path, it must be an exact parent
    // and the next part in the path must not exist (to avoid partial matches)
    if (routeParts.length < pathParts.length) {
      return normalizedCurrentPath === normalizedRoutePath;
    }

    // If they have the same number of parts, compare them directly
    return normalizedCurrentPath === normalizedRoutePath;
  });

  console.info('matched route', matchedRoute);

  return matchedRoute;
};
