import { createFileRoute } from '@tanstack/react-router';
import DidLogPage from '../../../pages/labs/DidLog';

export const Route = createFileRoute('/_main/labs/did-log')({
  component: DidLogPage,
  validateSearch: (search: Record<string, unknown>) => ({
    actor: typeof search.actor === 'string' ? search.actor : undefined,
  }),
});
