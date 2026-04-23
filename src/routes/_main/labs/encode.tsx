import { createFileRoute } from '@tanstack/react-router';
import EncodePage from '../../../pages/labs/Encode';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/encode')({
  component: EncodePage,
  head: () => pageMeta('lab/encode'),
});
