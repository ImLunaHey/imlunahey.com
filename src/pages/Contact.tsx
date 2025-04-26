import { Link } from 'react-router';

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-black border border-[#1a1a1a]">
      <p>
        You can contact me via Bluesky:{' '}
        <Link to="https://bsky.app/profile/imlunahey.com" className="text-blue-400 hover:underline">
          @imlunahey.com
        </Link>
      </p>
    </div>
  );
}
