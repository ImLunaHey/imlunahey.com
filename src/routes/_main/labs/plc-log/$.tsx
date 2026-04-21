import { createFileRoute } from '@tanstack/react-router';
import PlcLogPage from '../../../../pages/labs/PlcLog';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/plc-log/$')({
  component: PlcLogPage,
  head: () => pageMeta('lab/plc-log'),
});
