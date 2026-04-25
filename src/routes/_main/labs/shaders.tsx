import { createFileRoute } from '@tanstack/react-router';
import ShadersPage from '../../../pages/labs/Shaders';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/shaders')({
  component: ShadersPage,
  head: () => pageMeta('lab/shaders'),
});
