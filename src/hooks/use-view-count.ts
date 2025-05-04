import { useQuery } from '@tanstack/react-query';

export const useViewCount = ({ rkey }: { rkey: string }) => {
  const query = useQuery({
    queryKey: ['view-count', rkey],
    queryFn: async () => {
      return fetch(`https://stats.imlunahey.com/${rkey}`)
        .then((res) => res.json() as Promise<{ views: number }>)
        .then((data) => data.views);
    },
  });

  return query;
};
