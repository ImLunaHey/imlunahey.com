import { createFileRoute } from '@tanstack/react-router';
import CurlPage from '../../../pages/labs/Curl';

export const Route = createFileRoute('/_main/labs/curl')({
  component: CurlPage,
});
