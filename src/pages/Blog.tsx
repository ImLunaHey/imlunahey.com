import { Card } from '../components/Card';
import { RelativeTime } from '../components/RelativeTime';
import { useBlogEntries } from '../hooks/use-blog-entries';
import { useReadTime } from '../hooks/use-read-time';
import { useViewCount } from '../hooks/use-view-count';
import { BlogEntryResponse } from '../types/blog-entry';
import { Link } from 'react-router';
const Seperator = () => <div className="size-1 rounded-full bg-gray-200" />;

const Summary = ({ blogEntry }: { blogEntry: BlogEntryResponse<'did:plc:k6acu4chiwkixvdedcmdgmal'> }) => {
  const { data: readTime } = useReadTime({ rkey: blogEntry.uri.split('/').pop()! });
  const { data: views } = useViewCount({ rkey: blogEntry.uri.split('/').pop()! });

  return (
    <Card key={blogEntry.value.createdAt} className="p-2">
      <Link to={`/blog/${blogEntry.uri.split('/').pop()}`}>
        <h2 className="text-2xl font-bold">{blogEntry.value.title}</h2>
        <div className="flex items-center gap-2 text-sm">
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
      </Link>
    </Card>
  );
};

export default function BlogPage() {
  const { data: blogEntries, isLoading } = useBlogEntries('did:plc:k6acu4chiwkixvdedcmdgmal');

  if (isLoading) {
    return null;
  }

  if (!blogEntries) {
    return <div>No blog entries found</div>;
  }

  return (
    <div className="mx-auto flex max-w-screen-md flex-col gap-2">
      {blogEntries.slice(0, 10).map((blogEntry) => (
        <Summary key={blogEntry.value.createdAt} blogEntry={blogEntry} />
      ))}
    </div>
  );
}
