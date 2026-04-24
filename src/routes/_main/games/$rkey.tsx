import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/games/$rkey')({
  component: () => <ReviewDetailPage kind="game" backTo="/games" />,
  head: ({ params }) => pageMeta('games', { path: `/games/${params.rkey}` }),
});
