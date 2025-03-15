import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../cn';

type Route = {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
};

type RouterContextType = {
  currentPath: string;
  navigate: (to: string) => void;
};

const RouterContext = createContext<RouterContextType>({
  currentPath: window.location.pathname,
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);

export const useParams = () => {
  const { currentPath } = useRouter();
  const params = currentPath.split('/').filter(Boolean);
  return params;
};

type RouterProviderProps = {
  children: ReactNode;
};

export const RouterProvider = ({ children }: RouterProviderProps) => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setCurrentPath(to);
  };

  // Listen for popstate events (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return <RouterContext.Provider value={{ currentPath, navigate }}>{children}</RouterContext.Provider>;
};

type RouteComponentProps = {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
};

export const Route = ({ path, component: Component, exact = false }: RouteComponentProps) => {
  const { currentPath } = useRouter();

  // Determine if this route should be rendered
  const shouldRender = exact ? currentPath === path : currentPath.startsWith(path);

  return shouldRender ? (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Component />
    </motion.div>
  ) : null;
};

type RoutesProps = {
  routes: Route[];
  notFound: React.ComponentType;
};

export const Routes = ({ routes, notFound: NotFound }: RoutesProps) => {
  const { currentPath } = useRouter();

  // Find the first matching route
  const matchedRoute = routes.find((route) => {
    // For exact matches, compare paths directly
    if (route.exact) return currentPath === route.path;

    // For routes with parameters (e.g., /blog/:id)
    if (route.path.includes(':')) {
      const routeParts = route.path.split('/');
      const pathParts = currentPath.split('/');

      // Different segment count means no match
      if (routeParts.length !== pathParts.length) return false;

      // Check each segment - either exact match or parameter match
      return routeParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
    }

    // For regular routes, check if the current path starts with the route path
    return currentPath.startsWith(route.path);
  });

  // Render the component for the matched route or the wildcard route if no match
  return (
    <AnimatePresence mode="wait">
      {matchedRoute ? (
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <matchedRoute.component />
        </motion.div>
      ) : NotFound ? (
        <motion.div
          key="not-found"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <NotFound />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

type LinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
};

export const Link = ({ to, children, className }: LinkProps) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (to.startsWith('http')) {
      e.preventDefault();
      window.open(to, '_blank');
    } else {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={cn(className)}>
      {children}
    </a>
  );
};
