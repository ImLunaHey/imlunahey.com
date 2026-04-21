import { createFileRoute } from '@tanstack/react-router';
import AtUriPage from '../../../../pages/labs/AtUri';

export const Route = createFileRoute('/_main/labs/at-uri/$')({
  component: AtUriPage,
});
