import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';

export const Route = createFileRoute('/_main/watching/$rkey')({
  component: () => <ReviewDetailPage kind="watch" backTo="/watching" />,
});
