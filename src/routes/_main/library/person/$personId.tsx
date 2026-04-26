import { createFileRoute } from '@tanstack/react-router';
import PersonDetailPage from '../../../../pages/PersonDetail';
import { pageMeta } from '../../../../lib/og-meta';
import { getReviewedIds } from '../../../../server/popfeed';

export const Route = createFileRoute('/_main/library/person/$personId')({
  // Reuse the library OG slug; canonical URL points at the actual
  // person path so the indexer doesn't think every person page is the
  // /library landing.
  loader: async () => ({ reviewedIds: await getReviewedIds() }),
  component: PersonDetailPage,
  head: ({ params }) =>
    pageMeta('library', { path: `/library/person/${params.personId}` }),
});
