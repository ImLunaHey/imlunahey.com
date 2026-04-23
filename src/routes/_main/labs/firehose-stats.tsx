import { createFileRoute } from '@tanstack/react-router';
import FirehoseStatsPage from '../../../pages/labs/FirehoseStats';

export const Route = createFileRoute('/_main/labs/firehose-stats')({
  component: FirehoseStatsPage,
});
