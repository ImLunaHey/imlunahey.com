import { createFileRoute } from '@tanstack/react-router';
import BlogEntryPage from '../../../pages/BlogEntry';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/blog/$rkey')({
  component: BlogEntryPage,
  // Per-URL canonical so Ahrefs / Google don't flag every post as
  // "duplicate pages without canonical". Title stays the blog default
  // since the post title lives in PDS-fetched data we only have
  // client-side; an SSR loader could enrich this further.
  head: ({ params }) => pageMeta('blog', { path: `/blog/${params.rkey}` }),
});
