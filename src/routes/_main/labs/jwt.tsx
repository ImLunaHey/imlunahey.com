import { createFileRoute } from '@tanstack/react-router';
import JwtPage from '../../../pages/labs/Jwt';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/jwt')({
  component: JwtPage,
  head: () => pageMeta('lab/jwt'),
});
