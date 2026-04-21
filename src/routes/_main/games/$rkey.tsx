import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';

export const Route = createFileRoute('/_main/games/$rkey')({
  component: () => <ReviewDetailPage kind="game" backTo="/games" />,
});
