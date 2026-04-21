import { createFileRoute } from '@tanstack/react-router';
import AiPage from '../../pages/Ai';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/ai')({
  component: AiPage,
  head: () => pageMeta('ai'),
});
