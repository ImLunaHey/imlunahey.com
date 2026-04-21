import { createFileRoute } from '@tanstack/react-router';
import FeedPage from '../../../../pages/labs/Feed';

export const Route = createFileRoute('/_main/labs/feed/')({
  component: FeedPage,
});
