import { createFileRoute } from '@tanstack/react-router';
import ConverterPage from '../../../pages/labs/Converter';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/converter')({
  component: ConverterPage,
  head: () => pageMeta('lab/converter'),
});
