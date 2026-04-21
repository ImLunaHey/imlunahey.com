import { createFileRoute } from '@tanstack/react-router';
import BlogPage from '../../../pages/Blog';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/blog/')({
  component: BlogPage,
  head: () => pageMeta('blog'),
});
