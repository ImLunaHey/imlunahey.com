import { createFileRoute } from '@tanstack/react-router';
import JwtPage from '../../../pages/labs/Jwt';

export const Route = createFileRoute('/_main/labs/jwt')({
  component: JwtPage,
});
