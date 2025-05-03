import { Link } from 'react-router';

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center">
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
  );
}
