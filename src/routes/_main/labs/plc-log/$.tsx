import { createFileRoute } from '@tanstack/react-router';
import PlcLogPage from '../../../../pages/labs/PlcLog';

export const Route = createFileRoute('/_main/labs/plc-log/$')({
  component: PlcLogPage,
});
