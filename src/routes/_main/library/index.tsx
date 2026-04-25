import { createFileRoute } from '@tanstack/react-router';
import LibraryPage from '../../../pages/Library';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/library/')({
  component: LibraryPage,
  head: () => pageMeta('library'),
});
