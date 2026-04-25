import { createFileRoute } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/atrium/')({
  // The URL doesn't dictate which room you land in once D1 state has
  // loaded — `initialRoom="lobby"` is just the placeholder shown for
  // the brief moment before the bootstrap effect resolves.
  component: () => <AtriumPage initialRoom="lobby" />,
  head: () => pageMeta('lab/atrium'),
});
