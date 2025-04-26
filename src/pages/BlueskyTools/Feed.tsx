import { Card } from '../../components/Card';
import { useState, useCallback } from 'react';
import { XRPC, simpleFetchHandler } from '@atcute/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AppBskyEmbedImages, AppBskyFeedPost } from '@atcute/client/lexicons';
import { Loading } from '../../components/Loading';
import { ProfileCard } from '../../components/ProfileCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { RelativeTime } from '../../components/RelativeTime';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { InfiniteList } from '../../components/InfiniteList';
import { useProfile } from '../../hooks/use-profile';
import { Link, useNavigate, useParams } from 'react-router';

const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

const useAuthorFeed = (handle: string, enabled: boolean = true) => {
  const actor = handle.replace('@', '');
  return useInfiniteQuery({
    queryKey: ['author-feed', actor],
    queryFn: ({ pageParam }) =>
      rpc
        .get('app.bsky.feed.getAuthorFeed', {
          params: { actor, includePins: true, filter: 'posts_no_replies', cursor: pageParam },
        })
        .then((res) => res.data),
    enabled: !!actor && enabled,
    retry: false,
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
  });
};

const Images = ({ images }: { images: AppBskyEmbedImages.ViewImage[] }) => {
  if (images.length === 1) return <img src={images[0].fullsize} className="w-full h-full object-cover" />;
  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {images.map((image) => (
          <img key={image.thumb} src={image.fullsize} className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }
  if (images.length === 3) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {images.map((image) => (
          <img key={image.thumb} src={image.fullsize} className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }

  if (images.length === 4) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {images.map((image) => (
          <img key={image.thumb} src={image.fullsize} className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }

  return null;
};

const Results = ({ handle }: { handle: string }) => {
  const { data, isLoading, error, fetchNextPage, hasNextPage } = useAuthorFeed(handle);
  const feed = data?.pages.flatMap((page) => page.feed) ?? [];

  if (isLoading) return <Loading />;
  if (error) return <Card className="p-4 bg-red-500">Error: {error.message}</Card>;
  if (!data) return null;

  return (
    <InfiniteList
      items={feed}
      fetchMore={() => {
        if (hasNextPage) fetchNextPage();
      }}
      className="flex flex-col gap-2"
    >
      {(post) => {
        const record = post.post.record as AppBskyFeedPost.Record;
        const images = post.post.embed?.$type === 'app.bsky.embed.images#view' ? post.post.embed.images : [];
        const rkey = post.post.uri.split('/').pop()!;
        return (
          <Card key={post.post.uri} className="p-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <img src={post.post.author.avatar} className="w-6 h-6 rounded-full" />
              <div>{post.post.author.displayName}</div>
              <Link to={`https://bsky.app/profile/${post.post.author.did}`} className="text-gray-500">
                <ProfileCard actor={post.post.author.did} />
              </Link>
              {post.reason ? (
                <div className="text-gray-500">{post.reason.$type === 'app.bsky.feed.defs#reasonPin' ? '📌' : '🔁'}</div>
              ) : null}
            </div>
            <div>{record.text}</div>
            <Images images={images} />
            <ErrorBoundary fallback={<div>Error loading time</div>}>
              <div className="text-xs text-gray-500">
                <Link to={`https://bsky.app/profile/${post.post.author.did}/post/${rkey}`} className="hover:underline">
                  <RelativeTime date={new Date(record.createdAt)} />
                </Link>
              </div>
            </ErrorBoundary>
          </Card>
        );
      }}
    </InfiniteList>
  );
};

export default function BlueskyToolsFeedPage() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params[3];
  const [handle, setHandle] = useState(id ?? '');
  const [input, setInput] = useState(id ?? '');
  const { data: profile, isLoading: isProfileLoading } = useProfile({ actor: handle });
  const isPrivate = profile?.labels?.find((label) => label.val === '!no-unauthenticated') !== undefined;
  const [showPrivate, setShowPrivate] = useState(false);
  const { isLoading } = useAuthorFeed(handle, !isPrivate || false);

  const onSubmit = useCallback(() => {
    setHandle(input);
    navigate(`/bluesky/tools/feed/${input}`);
  }, [input, navigate]);

  return (
    <div className="flex flex-col gap-2">
      <Card className="p-4 flex flex-col gap-2">
        <Input
          value={input}
          onChangeValue={setInput}
          onSubmit={onSubmit}
          placeholder="Enter a handle (e.g. @imlunahey.bsky.social)"
          disabled={isLoading || isProfileLoading}
        />
        <Button onClick={onSubmit} disabled={isLoading}>
          Get Feed
        </Button>
      </Card>
      {isProfileLoading ? (
        <Loading />
      ) : isPrivate && !showPrivate ? (
        <div>
          <Card className="p-4 flex flex-col gap-2">
            <div>This profile is private, are you sure you want to continue?</div>
            <Button onClick={() => setShowPrivate(true)}>Continue</Button>
          </Card>
        </div>
      ) : (
        <Results handle={handle} />
      )}
    </div>
  );
}
