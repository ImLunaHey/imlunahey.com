import { createFileRoute } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/atrium/')({
  // No roomId in the URL → fall through to whatever the user was last
  // in (persisted in localStorage), so refreshing doesn't drop you back
  // in the lobby. AtriumPage handles the localStorage lookup; here we
  // just signal "no explicit room requested".
  component: () => <AtriumPage />,
  head: () => pageMeta('lab/atrium'),
});
