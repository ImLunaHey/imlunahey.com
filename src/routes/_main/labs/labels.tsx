import { createFileRoute } from '@tanstack/react-router';
import LabelsPage from '../../../pages/labs/Labels';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/labels')({
  component: LabelsPage,
  head: () => pageMeta('lab/labels'),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    // comma-separated list of extra labeler handles/dids to query beyond
    // bluesky's default one. url-persisted so shares preserve the scan.
    labelers: typeof search.labelers === 'string' ? search.labelers : undefined,
  }),
});
