import { createFileRoute } from '@tanstack/react-router';
import PasswordPage from '../../../pages/labs/Password';

export const Route = createFileRoute('/_main/labs/password')({
  component: PasswordPage,
});
