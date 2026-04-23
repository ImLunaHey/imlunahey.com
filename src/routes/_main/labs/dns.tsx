import { createFileRoute } from '@tanstack/react-router';
import DnsPage from '../../../pages/labs/Dns';

export const Route = createFileRoute('/_main/labs/dns')({
  component: DnsPage,
});
