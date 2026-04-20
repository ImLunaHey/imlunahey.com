import { createFileRoute } from '@tanstack/react-router';
import FeedPage from '../../../../../pages/BlueskyTools/Feed';

export const Route = createFileRoute('/_main/bluesky/tools/feed/$id')({
  component: FeedPage,
});
