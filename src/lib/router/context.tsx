import { createContext } from 'react';

export const RouterContext = createContext({
  currentPath: window.location.pathname,
  navigate: (to: string) => {
    window.history.pushState({}, '', to);
  },
  replace: (to: string) => {
    window.history.replaceState({}, '', to);
  },
});
