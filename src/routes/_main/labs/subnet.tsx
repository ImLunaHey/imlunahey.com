import { createFileRoute } from '@tanstack/react-router';
import SubnetPage from '../../../pages/labs/Subnet';

export const Route = createFileRoute('/_main/labs/subnet')({
  component: SubnetPage,
});
