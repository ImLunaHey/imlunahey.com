import { useQuery } from '@tanstack/react-query';
import { simpleFetchHandler, XRPC } from '@atcute/client';
import { AppBskyFeedPost } from '@atcute/client/lexicons';

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

export const useBlogEntryComments = ({ uri }: { uri: string | null | undefined }) => {
  const query = useQuery({
    queryKey: ['comments', uri],
    queryFn: async () => {
      if (!uri) return null;

      const response = await rpc.get('app.bsky.feed.getPostThread', {
        params: {
          uri,
        },
      });

      const thread = response.data.thread;
      if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
        throw new Error('Invalid thread');
      }

      const replies = thread.replies?.filter((reply) => reply.$type === 'app.bsky.feed.defs#threadViewPost') ?? [];

      return replies.sort((a, b) => {
        return (
          new Date((a.post.record as AppBskyFeedPost.Record).createdAt).getTime() -
          new Date((b.post.record as AppBskyFeedPost.Record).createdAt).getTime()
        );
      });
    },
  });

  return query;
};
