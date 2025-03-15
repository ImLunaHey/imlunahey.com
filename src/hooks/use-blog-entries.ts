import { useQuery } from '@tanstack/react-query';
import { simpleFetchHandler, XRPC } from '@atcute/client';

type BlogEntry<did extends string> = {
  uri: string;
  cid: string;
  value: {
    $type: 'com.whtwnd.blog.entry';
    theme: string;
    title: string;
    content: string;
    createdAt: string;
    visibility: 'public' | 'private';
    comments?: `at://${did}/com.whtwnd.blog.entry/${string}`;
  };
};

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://bsky.social' }) });

export function useBlogEntries<T extends string>(did: T) {
  const query = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const response = await rpc.get('com.atproto.repo.listRecords', {
        params: {
          repo: did,
          collection: 'com.whtwnd.blog.entry',
        },
      });
      return (response.data.records as BlogEntry<typeof did>[])
        .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
        .filter((entry) => entry.value.visibility === 'public');
    },
  });

  return query;
}
