import { createFileRoute } from '@tanstack/react-router';
import HttpStatusPage from '../../../pages/labs/HttpStatus';

export const Route = createFileRoute('/_main/labs/http-status')({
  component: HttpStatusPage,
});
