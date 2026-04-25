import { createFileRoute } from '@tanstack/react-router';
import LibraryDetailPage from '../../../pages/LibraryDetail';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/library/$imdbId')({
  component: LibraryDetailPage,
  // detail pages share the /library OG slug — overriding `path` so the
  // canonical URL points at the actual entry instead of the parent
  head: ({ params }) =>
    pageMeta('library', { path: `/library/${params.imdbId}` }),
});
