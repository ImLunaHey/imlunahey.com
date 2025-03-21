import { NavBar } from '../components/NavBar';
import { Page } from '../components/Page';

export default function ReferralChecker() {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Referral Checker</h1>
        <p className="text-sm text-gray-500">
          you came from <span className="font-bold">{window.frames.top?.document.referrer ?? 'unknown'}</span>
        </p>
      </div>
    </Page>
  );
}
