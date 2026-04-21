import { createFileRoute } from '@tanstack/react-router';
import GuestbookPage from '../../pages/Guestbook';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/guestbook')({
  component: GuestbookPage,
  head: () => pageMeta('guestbook'),
});
