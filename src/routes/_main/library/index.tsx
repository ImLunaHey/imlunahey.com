import { createFileRoute } from '@tanstack/react-router';
import LibraryPage from '../../../pages/Library';
import { pageMeta } from '../../../lib/og-meta';
import { getReviewedImdbIds } from '../../../server/popfeed';

export const Route = createFileRoute('/_main/library/')({
  // Loader runs on SSR + client so the seen-state is baked into the
  // initial paint instead of flashing in after a client fetch. Server
  // fn caches via TTL.short so repeat visits are cheap.
  loader: async () => ({ reviewedImdbIds: await getReviewedImdbIds() }),
  component: LibraryPage,
  head: () => pageMeta('library'),
});
