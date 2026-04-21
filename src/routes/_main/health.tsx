import { createFileRoute } from '@tanstack/react-router';
import HealthPage from '../../pages/Health';

export const Route = createFileRoute('/_main/health')({
  component: HealthPage,
});
