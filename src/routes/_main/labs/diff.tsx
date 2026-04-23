import { createFileRoute } from '@tanstack/react-router';
import DiffPage from '../../../pages/labs/Diff';

export const Route = createFileRoute('/_main/labs/diff')({
  component: DiffPage,
});
