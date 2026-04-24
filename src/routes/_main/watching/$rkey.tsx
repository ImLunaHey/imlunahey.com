import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/watching/$rkey')({
  component: () => <ReviewDetailPage kind="watch" backTo="/watching" />,
  head: ({ params }) => pageMeta('watching', { path: `/watching/${params.rkey}` }),
});
