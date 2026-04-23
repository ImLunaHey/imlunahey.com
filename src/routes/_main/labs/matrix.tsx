import { createFileRoute } from '@tanstack/react-router';
import MatrixPage from '../../../pages/labs/Matrix';

export const Route = createFileRoute('/_main/labs/matrix')({
  component: MatrixPage,
});
