import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { matchRoute } from './match-route';
import { useRouter } from './use-router';

export type Route = {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
};

type RoutesProps = {
  routes: Route[];
};

export const Routes = ({ routes }: RoutesProps) => {
  const { currentPath } = useRouter();

  // Find the first matching route
  const matchedRoute = matchRoute(currentPath, routes);

  // Use the matched route's path as the key instead of currentPath
  // This ensures the component doesn't re-render when only the parameters change
  // or when router.replace is called with a different path that matches the same route
  const routeKey = matchedRoute ? matchedRoute.path : 'not-found';

  // Render the component for the matched route or the wildcard route if no match
  return (
    <AnimatePresence mode="wait">
      {matchedRoute ? (
        <motion.div
          key={routeKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <matchedRoute.component />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
