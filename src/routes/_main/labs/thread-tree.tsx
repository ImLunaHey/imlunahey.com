import { createFileRoute } from '@tanstack/react-router';
import ThreadTreePage from '../../../pages/labs/ThreadTree';

export const Route = createFileRoute('/_main/labs/thread-tree')({
  component: ThreadTreePage,
  validateSearch: (search: Record<string, unknown>) => ({
    uri: typeof search.uri === 'string' ? search.uri : undefined,
  }),
});
