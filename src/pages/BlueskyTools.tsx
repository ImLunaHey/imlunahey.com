import { Page } from '../components/Page';
import { NavBar } from '../components/NavBar';
import { Card } from '../components/Card';
import { Link } from '../lib/router/Link';

const tools = [
  {
    name: 'PDF Uploader',
    description: 'A tool to upload a PDF file to Bluesky.',
    url: '/bluesky/tools/pdf-uploader',
  },
  {
    name: 'Feed',
    description: 'A tool to view the feed of a bluesky user.',
    url: '/bluesky/tools/feed',
  },
  {
    name: 'List Cleaner',
    description:
      'A tool to remove lists you are subscribed to that have been deleted or were made by accounts that are deleted/suspended.',
    url: '/bluesky/tools/list-cleaner',
  },
];

export default function BlueskyToolsPage() {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <Card key={tool.name} className="p-2">
            <h2 className="text-xl font-bold">{tool.name}</h2>
            <p className="text-sm text-gray-500">{tool.description}</p>
            <Link to={tool.url} className="text-sm text-blue-500">
              View Tool
            </Link>
          </Card>
        ))}
      </div>
    </Page>
  );
}
