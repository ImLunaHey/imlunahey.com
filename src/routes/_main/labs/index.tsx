import { createFileRoute } from '@tanstack/react-router';
import LabsPage from '../../../pages/Labs';

export const Route = createFileRoute('/_main/labs/')({
  component: LabsPage,
});
