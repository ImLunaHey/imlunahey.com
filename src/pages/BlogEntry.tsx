import { AppBskyFeedDefs, AppBskyFeedPost } from '@atcute/client/lexicons';
import { useBlogEntry } from '../hooks/use-blog-entry';
import { useBlogEntryComments } from '../hooks/use-blog-entry-comments';
import { Link, useParams } from '../lib/router';
import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { RelativeTime } from '../components/RelativeTime';

const Comment = ({ comment }: { comment: AppBskyFeedDefs.ThreadViewPost }) => {
  const record = comment.post.record as AppBskyFeedPost.Record;
  return (
    <div key={comment.post.uri} className="border-y border-[#1a1a1a] p-2 bg-black">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link to={`https://bsky.app/profile/${comment.post.author.did}`}>
            <img src={comment.post.author.avatar} className="w-6 h-6 rounded-full" />
          </Link>
          <div>{comment.post.author.displayName}</div>
        </div>
        <div>{record.text}</div>
        <div className="text-xs text-gray-500">
          <RelativeTime date={new Date(record.createdAt)} />
        </div>
      </div>
    </div>
  );
};

export const BlogEntryPage = () => {
  const params = useParams();
  const id = params[1];

  const { data: blogEntry } = useBlogEntry('did:plc:k6acu4chiwkixvdedcmdgmal', id);
  const { data: comments } = useBlogEntryComments(blogEntry?.value.comments);

  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 bg-black border border-[#1a1a1a] p-2">
          <div>
            <h1 className="text-2xl font-bold">{blogEntry?.value.title}</h1>
          </div>
          <div>{blogEntry?.value.content}</div>
        </div>
        <h2 className="text-lg font-bold">Comments</h2>
        <div className="flex flex-col gap-2 bg-black border border-[#1a1a1a]">
          {comments?.map((comment) => (
            <Comment key={comment.post.uri} comment={comment} />
          ))}
        </div>
      </div>
    </Page>
  );
};
