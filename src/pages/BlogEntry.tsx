import { AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/client/lexicons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useBlogEntry } from '../hooks/use-blog-entry';
import { useBlogEntryComments } from '../hooks/use-blog-entry-comments';
import { Link, useParams } from '../lib/router';
import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { RelativeTime } from '../components/RelativeTime';
import { useProfile } from '../hooks/use-profile';
import { useReadTime } from '../hooks/use-read-time';
import { useViewCount } from '../hooks/use-view-count';
import { Loading } from '../components/Loading';
import { ProfileCard } from '../components/ProfileCard';
import { Card } from '../components/Card';

const Comment = ({ comment }: { comment: AppBskyFeedDefs.ThreadViewPost }) => {
  const record = comment.post.record as AppBskyFeedPost.Record;
  return (
    <Card key={comment.post.uri} className="p-2">
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
        <div className="text-xs text-gray-500">
          <RelativeTime date={new Date(record.createdAt)} />
        </div>
      </div>
    </Card>
  );
};

const Comments = ({ uri }: { uri: string }) => {
  const { data: comments, isLoading } = useBlogEntryComments({ uri });

  if (isLoading) return <Loading />;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">Comments</h2>
      {comments?.map((comment) => (
        <Comment key={comment.post.uri} comment={comment} />
      ))}
    </div>
  );
};

const Seperator = () => <div className="size-1 bg-gray-200 rounded-full" />;

const BlogEntry = ({ rkey }: { rkey: string }) => {
  const { data: profile, isLoading: profileLoading } = useProfile({ actor: 'did:plc:k6acu4chiwkixvdedcmdgmal' });
  const { data: blogEntry, isLoading: blogEntryLoading } = useBlogEntry({
    author: 'did:plc:k6acu4chiwkixvdedcmdgmal',
    rkey,
  });
  const { data: readTime, isLoading: readTimeLoading } = useReadTime({ rkey });
  const { data: views, isLoading: viewsLoading } = useViewCount({ rkey });

  if (profileLoading || blogEntryLoading || readTimeLoading || viewsLoading) return <Loading />;
  if (!profile || !blogEntry) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 bg-black border border-[#1a1a1a] p-2">
        <h1 className="text-4xl font-bold">{blogEntry?.value.title}</h1>
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
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => {
              if (props.href) {
                return (
                  <Link to={props.href} className="text-blue-500 hover:underline">
                    {children}
                  </Link>
                );
              }
              return <a {...props}>{children}</a>;
            },
            h1: ({ children }) => <h1 className="text-2xl font-bold">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-bold">{children}</h3>,
            h4: ({ children }) => <h4 className="text-base font-bold">{children}</h4>,
            h5: ({ children }) => <h5 className="text-sm font-bold">{children}</h5>,
            h6: ({ children }) => <h6 className="text-xs font-bold">{children}</h6>,
          }}
        >
          {blogEntry.value.content}
        </Markdown>
      </div>
      {blogEntry.value.comments ? <Comments uri={blogEntry.value.comments} /> : null}
    </div>
  );
};

export const BlogEntryPage = () => {
  const params = useParams();
  const rkey = params[1];

  return (
    <Page>
      <NavBar />
      <BlogEntry rkey={rkey} />
    </Page>
  );
};
