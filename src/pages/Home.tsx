export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">👋 hi, i'm luna</h1>
      <p className="text-lg">i'm a software engineer based in london.</p>
      <div className="flex flex-row gap-4">
        <a href="https://github.com/imlunahey" className="hover:underline">
          github
        </a>
        <a href="https://bsky.app/profile/imlunahey.com" className="hover:underline">
          bluesky
        </a>
      </div>
    </div>
  );
}
