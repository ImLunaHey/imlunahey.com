import { createFileRoute } from '@tanstack/react-router';
import CsvPage from '../../../pages/labs/Csv';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/csv')({
  component: CsvPage,
  head: () => pageMeta('lab/csv'),
});
