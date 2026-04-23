import { createFileRoute } from '@tanstack/react-router';
import HttpHeadersPage from '../../../pages/labs/HttpHeaders';

export const Route = createFileRoute('/_main/labs/http-headers')({
  component: HttpHeadersPage,
});
