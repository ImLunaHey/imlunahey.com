import { createFileRoute } from '@tanstack/react-router';
import BlogPage from '../../../pages/Blog';
import { getBlogEntries } from '../../../server/whitewind';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/blog/')({
  component: BlogPage,
  loader: () => ({ blog: getBlogEntries() }),
  staleTime: TTL.short,
});
