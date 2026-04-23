import { createFileRoute } from '@tanstack/react-router';
import WhoisPage from '../../../pages/labs/Whois';

export const Route = createFileRoute('/_main/labs/whois')({
  component: WhoisPage,
});
