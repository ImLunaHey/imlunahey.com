import { ReactNode, useEffect, useState } from 'react';
import { RouterContext } from './context';

type RouterProviderProps = {
  children: ReactNode;
};

export const RouterProvider = ({ children }: RouterProviderProps) => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setCurrentPath(to);
  };

  const replace = (to: string) => {
    window.history.replaceState({}, '', to);
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

  return <RouterContext.Provider value={{ currentPath, navigate, replace }}>{children}</RouterContext.Provider>;
};
