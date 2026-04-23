import { createFileRoute } from '@tanstack/react-router';
import PasswordPage from '../../../pages/labs/Password';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/password')({
  component: PasswordPage,
  head: () => pageMeta('lab/password'),
});
