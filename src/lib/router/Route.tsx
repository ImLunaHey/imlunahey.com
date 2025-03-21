import { ComponentType } from 'react';
import { useRouter } from './use-router';
import { motion } from 'framer-motion';

export const Route = ({
  path,
  component: Component,
  exact = false,
}: {
  path: string;
  component: ComponentType;
  exact?: boolean;
}) => {
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
