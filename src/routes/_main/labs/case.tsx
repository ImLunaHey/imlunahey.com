import { createFileRoute } from '@tanstack/react-router';
import CasePage from '../../../pages/labs/Case';

export const Route = createFileRoute('/_main/labs/case')({
  component: CasePage,
});
