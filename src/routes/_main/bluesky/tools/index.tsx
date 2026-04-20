import { createFileRoute } from '@tanstack/react-router';
import BlueskyToolsPage from '../../../../pages/BlueskyTools';

export const Route = createFileRoute('/_main/bluesky/tools/')({
  component: BlueskyToolsPage,
});
