import { useQuery } from '@tanstack/react-query';
import { BlogEntryResponse } from '../types/blog-entry';
import { simpleFetchHandler, XRPC } from '@atcute/client';

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://bsky.social' }) });

export function useBlogEntry<T extends string>({ author, rkey }: { author: T; rkey: string | undefined }) {
  const query = useQuery({
    queryKey: ['post', rkey],
    queryFn: async () => {
      if (!rkey) return null;

      const response = await rpc.get('com.atproto.repo.getRecord', {
        params: {
          repo: author,
          collection: 'com.whtwnd.blog.entry',
          rkey,
        },
      });

      return response.data as BlogEntryResponse<T>;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: false,
    enabled: !!rkey,
  });

  return query;
}
