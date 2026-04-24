import { useQuery } from '@tanstack/react-query';
import { simpleFetchHandler, XRPC } from '@atcute/client';

type BlogEntry<did extends string> = {
  uri: string;
  cid: string;
  value: {
    $type: 'com.whtwnd.blog.entry';
    theme?: 'github-light';
    title?: string;
    content: string;
    createdAt?: string;
    // real lexicon enum — see src/types/blog-entry.ts
    visibility?: 'public' | 'url' | 'author';
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
        .sort((a, b) => (b.value.createdAt ?? '').localeCompare(a.value.createdAt ?? ''))
        // listable only: 'public' explicitly, or unset (lexicon default is 'public')
        .filter((entry) => entry.value.visibility === 'public' || entry.value.visibility === undefined);
    },
  });

  return query;
}
