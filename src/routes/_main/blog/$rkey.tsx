import { createFileRoute } from '@tanstack/react-router';
import BlogEntryPage from '../../../pages/BlogEntry';
import { getBlogEntries } from '../../../server/whitewind';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/blog/$rkey')({
  component: BlogEntryPage,
  loader: () => ({ blog: getBlogEntries() }),
  staleTime: TTL.short,
});
