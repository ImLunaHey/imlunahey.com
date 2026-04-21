import { createFileRoute } from '@tanstack/react-router';
import CronPage from '../../../pages/labs/Cron';

export const Route = createFileRoute('/_main/labs/cron')({
  component: CronPage,
});
