import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { Link } from '../lib/router/Link';

export default function HomePage() {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-5rem)]">
        <h1 className="text-4xl font-bold">👋 hi, i'm luna</h1>
        <p className="text-lg">i'm a software engineer based in london.</p>
        <div className="flex flex-row gap-4">
          <Link to="https://github.com/imlunahey" className="hover:underline">
            github
          </Link>
          <Link to="https://bsky.app/profile/imlunahey.com" className="hover:underline">
            bluesky
          </Link>
        </div>
      </div>
    </Page>
  );
}
