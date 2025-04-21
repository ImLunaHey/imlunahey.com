import { AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/client/lexicons';
import { useBlogEntry } from '../hooks/use-blog-entry';
import { useBlogEntryComments } from '../hooks/use-blog-entry-comments';
import { Link, Navigate, useParams } from 'react-router';
import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { RelativeTime } from '../components/RelativeTime';
import { useProfile } from '../hooks/use-profile';
import { useReadTime } from '../hooks/use-read-time';
import { useViewCount } from '../hooks/use-view-count';
import { Loading } from '../components/Loading';
import { ProfileCard } from '../components/ProfileCard';
import { Card } from '../components/Card';
import { cn } from '../cn';
import { MarkdownPreview } from '../components/MarkdownPreview';
import { H1 } from '../components/Heading';

const Comment = ({ comment, className }: { comment: AppBskyFeedDefs.ThreadViewPost; className?: string }) => {
  const record = comment.post.record as AppBskyFeedPost.Record;
  const images = comment.post.embed?.$type === 'app.bsky.embed.images#view' ? comment.post.embed.images : [];
  const replies =
    comment.replies
      ?.filter((reply) => reply.$type === 'app.bsky.feed.defs#threadViewPost')
      .sort((a, b) => {
        return (
          new Date((a.post.record as AppBskyFeedPost.Record).createdAt).getTime() -
          new Date((b.post.record as AppBskyFeedPost.Record).createdAt).getTime()
        );
      }) ?? [];

  return (
    <>
      <Card key={comment.post.uri} className={cn('p-2', className)}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link to={`https://bsky.app/profile/${comment.post.author.did}`}>
              <img src={comment.post.author.avatar} className="w-6 h-6 rounded-full" loading="lazy" />
            </Link>
            <Link to={`https://bsky.app/profile/${comment.post.author.did}`} className="hover:underline">
              {comment.post.author.displayName}
            </Link>
            <Link to={`https://bsky.app/profile/${comment.post.author.did}`} className="text-gray-500">
              <ProfileCard actor={comment.post.author.did} />
            </Link>
          </div>
          <div>{record.text}</div>
          {images.map((image) => (
            <div key={image.thumb}>
              <img
                src={image.fullsize}
                loading="lazy"
                alt={image.alt}
                width={image.aspectRatio?.width}
                height={image.aspectRatio?.height}
              />
            </div>
          ))}
          <div className="text-xs text-gray-500">
            <RelativeTime date={new Date(record.createdAt)} />
          </div>
        </div>
      </Card>
      <div className="w-full flex flex-col gap-1">
        {replies.map((reply) => {
          const comment = reply.$type === 'app.bsky.feed.defs#threadViewPost' ? reply : null;
          if (!comment) return null;

          return (
            <div className="pl-2">
              <div className="border-l border-gray-200">
                <Comment key={comment.post.uri} comment={comment} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const Comments = ({ uri }: { uri: string }) => {
  const { data: comments, isLoading } = useBlogEntryComments({ uri });
  const parts = uri.split('//')[1].split('/');
  const actor = parts[0];
  const rkey = parts[2];
  const postUrl = `https://bsky.app/profile/${actor}/post/${rkey}`;

  if (isLoading) return <Loading />;
  if (!comments || comments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-lg font-bold">Comments</h2>
        <Link to={postUrl} className="text-sm text-gray-500 hover:underline">
          join the conversation
        </Link>
      </div>
      {comments?.map((comment) => (
        <Comment key={comment.post.uri} comment={comment} />
      ))}
    </div>
  );
};

const Seperator = () => <div className="size-1 bg-gray-200 rounded-full" />;

const BlogEntry = ({ rkey }: { rkey: string }) => {
  const {
    data: blogEntry,
    isLoading: blogEntryLoading,
    isError: blogEntryError,
  } = useBlogEntry({
    author: 'did:plc:k6acu4chiwkixvdedcmdgmal',
    rkey,
  });
  const { data: profile, isLoading: profileLoading } = useProfile({ actor: 'did:plc:k6acu4chiwkixvdedcmdgmal' });
  const { data: readTime, isLoading: readTimeLoading } = useReadTime({ rkey });
  const { data: views, isLoading: viewsLoading } = useViewCount({ rkey });

  if (blogEntryError) <Navigate replace to="/not-found" />;
  if (profileLoading || blogEntryLoading || readTimeLoading || viewsLoading) return <Loading />;
  if (!profile || !blogEntry) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 bg-black border border-[#1a1a1a] p-2">
        <H1 className="text-3xl m-0">{blogEntry?.value.title}</H1>
        <div className="flex items-center gap-2 text-sm">
          <img src={profile.avatar} className="size-6 rounded-full" loading="eager" />
          <div>{profile.displayName}</div>
          <Seperator />
          {blogEntry.value.createdAt ? <RelativeTime date={new Date(blogEntry.value.createdAt)} /> : null}
          <Seperator />
          <div>{readTime?.text}</div>
          {views ? (
            <>
              <Seperator />
              <div>{views} views</div>
            </>
          ) : null}
        </div>
        <MarkdownPreview content={blogEntry.value.content} />
      </div>
      {blogEntry.value.comments ? <Comments uri={blogEntry.value.comments} /> : null}
    </div>
  );
};

export default function BlogEntryPage() {
  const params = useParams<{ rkey: string }>();
  const rkey = params.rkey;

  if (!rkey) return <Navigate replace to="/not-found" />;

  return (
    <Page>
      <NavBar />
      <BlogEntry rkey={rkey} />
    </Page>
  );
}
