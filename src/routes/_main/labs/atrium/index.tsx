import { createFileRoute } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/atrium/')({
  // No roomId in the URL → land in the lobby. Same component handles
  // both routes; only the prop differs.
  component: () => <AtriumPage roomId="lobby" />,
  head: () => pageMeta('lab/atrium'),
});
