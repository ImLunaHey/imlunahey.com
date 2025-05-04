import { Flags } from '../components/feetchair';
import { useQuery } from '@tanstack/react-query';

export const useFeatureFlags = () => {
  return useQuery({
    queryKey: ['feetchair'],
    queryFn: async () => {
      const serverFlags = (await fetch('/_feetchair/flags').then((response) => response.json())) as Flags;
      const localFlags = Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('feetchair-')));
      return serverFlags.map((flag) => ({
        ...flag,
        enabled: localFlags[flag.id] ? localFlags[flag.id] === 'true' : flag.enabled,
      }));
    },
  });
};
