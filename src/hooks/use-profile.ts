import { simpleFetchHandler } from '@atcute/client';
import { XRPC } from '@atcute/client';
import { useQuery } from '@tanstack/react-query';

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

export const useProfile = ({ actor }: { actor: string }) => {
  const query = useQuery({
    queryKey: ['profile', actor],
    queryFn: async () => {
      const response = await rpc.get('app.bsky.actor.getProfile', {
        params: {
          actor,
        },
      });
      return response.data;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  return query;
};
