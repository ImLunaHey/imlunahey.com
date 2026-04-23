import { createFileRoute } from '@tanstack/react-router';
import BookmarksPage from '../../pages/Bookmarks';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/bookmarks')({
  component: BookmarksPage,
  head: () => pageMeta('bookmarks'),
});
