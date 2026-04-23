import { createFileRoute } from '@tanstack/react-router';
import TimestampPage from '../../../pages/labs/Timestamp';

export const Route = createFileRoute('/_main/labs/timestamp')({
  component: TimestampPage,
});
