import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { RelativeTime } from '../components/RelativeTime';
import { useBlogEntries } from '../hooks/use-blog-entries';
import { Link } from '../lib/router';

export const BlogEntries = ({ count = 10 }: { count?: number }) => {
  const { data: blogEntries, isLoading } = useBlogEntries('did:plc:k6acu4chiwkixvdedcmdgmal');

  if (isLoading) {
    return null;
  }

  if (!blogEntries) {
    return <div>No blog entries found</div>;
  }

  return (
    <div className="max-w-screen-md mx-auto p-4">
      {blogEntries.slice(0, count).map((entry) => (
        <div key={entry.value.createdAt}>
          <Link to={`/blog/${entry.uri.split('/').pop()}`}>
            <h2 className="text-2xl font-bold">{entry.value.title}</h2>
            <RelativeTime date={new Date(entry.value.createdAt)} />
          </Link>
        </div>
      ))}
    </div>
  );
};

export const BlogPage = () => {
  return (
    <Page>
      <NavBar />
      <BlogEntries />
    </Page>
  );
};
