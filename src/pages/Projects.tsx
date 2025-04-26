import { Card } from '../components/Card';
import { Link } from 'react-router';

type Project = {
  name: string;
  description: string;
  url: string;
};

const projects: Project[] = [
  {
    name: 'lunafications',
    description:
      'a bluesky bot that notifies you when you get blocked, added to lists, or when specific accounts make posts.',
    url: 'https://github.com/imlunahey/lunafications',
  },
  {
    name: 'ALT text reminder',
    description: 'a bluesky bot that reminds you to add ALT text to your images if you reply to @ImLunaHey.com without it.',
    url: 'https://github.com/imlunahey/alt-text-reminder',
  },
  {
    name: 'sentiment bot',
    description: "a bluesky bot that replies to user's who tag it with the semtiment of their last 100 posts.",
    url: 'https://github.com/imlunahey/sentimentbot',
  },
  {
    name: 'imlunahey.com',
    description: 'My personal website.',
    url: 'https://github.com/imlunahey/imlunahey.com',
  },
  {
    name: 'english word bot',
    description: 'a bluesky bot that posts a random english word every 10 minutes.',
    url: 'https://github.com/imlunahey/english-word-bot',
  },
  {
    name: 'bluesky PDF uploader',
    description: 'a website that allows you to upload PDFs directly to bluesky.',
    url: 'https://github.com/imlunahey/bluesky-pdf-upload',
  },
  {
    name: 'CT logs',
    description: 'scrapes certificate transparency logs from the internet and saves them to axiom.co',
    url: 'https://github.com/imlunahey/ct-logs',
  },
  {
    name: 'CSS showcase',
    description: 'a showcase of random CSS projects.',
    url: '/showcase',
  },
  {
    name: 'bluesky tools',
    description: 'a collection of tools for bluesky.',
    url: '/bluesky/tools',
  },
  {
    name: 'popsky - movies',
    description: 'all of my movie reviews on popsky.',
    url: '/movies',
  },
  {
    name: 'popsky - shows',
    description: 'all of my show reviews on popsky.',
    url: '/shows',
  },
  {
    name: 'infinite canvas',
    description: 'an infinite canvas of images.',
    url: '/infinite-canvas',
  },
  // {
  //   name: 'whitewind',
  //   description: 'a tool for creating whitewind posts.',
  //   url: '/whitewind',
  // },
  // {
  //   name: 'referral checker',
  //   description: 'a way to check the referral header.',
  //   url: '/referral-checker',
  // },
];

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-2">
      {projects.map((project) => (
        <Card key={project.name} className="p-2">
          <h2 className="text-xl font-bold">{project.name}</h2>
          <p className="text-sm text-gray-500">{project.description}</p>
          <Link to={project.url} className="text-sm text-blue-500">
            View Project
          </Link>
        </Card>
      ))}
    </div>
  );
}
