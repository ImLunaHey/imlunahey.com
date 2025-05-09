import { Card } from '../components/Card';

export default function ReferralChecker() {
  const referrer = window.frames.top?.document.referrer;
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="text-sm text-gray-500">
        you came from <span className="font-bold">{referrer || 'somewhere'}</span>
      </p>
    </Card>
  );
}
