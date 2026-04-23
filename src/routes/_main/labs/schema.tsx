import { createFileRoute } from '@tanstack/react-router';
import SchemaPage from '../../../pages/labs/Schema';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/schema')({
  component: SchemaPage,
  head: () => pageMeta('lab/schema'),
});
