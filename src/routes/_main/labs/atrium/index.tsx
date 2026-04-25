import { createFileRoute } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/atrium/')({
  // No roomId in the URL → land in the lobby. The roomId prop only
  // seeds the initial state of AtriumPage; once mounted, in-app
  // navigation between rooms (walking through portals) is internal
  // state, never a URL change.
  component: () => <AtriumPage initialRoom="lobby" />,
  head: () => pageMeta('lab/atrium'),
});
