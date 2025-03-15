import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';
import { Link } from '../lib/router';

export const ContactPage = () => {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-4 p-4 bg-black border border-[#1a1a1a]">
        <p>
          You can contact me via Bluesky:{' '}
          <Link to="https://bsky.app/profile/imlunahey.com" className="text-blue-400 hover:underline">
            @imlunahey.com
          </Link>
        </p>
      </div>
    </Page>
  );
};
