import { createFileRoute } from '@tanstack/react-router';
import ListCleanerPage from '../../../../pages/BlueskyTools/ListCleaner';

export const Route = createFileRoute('/_main/bluesky/tools/list-cleaner')({
  component: ListCleanerPage,
});
