import { createFileRoute } from '@tanstack/react-router';
import HashPage from '../../../pages/labs/Hash';

export const Route = createFileRoute('/_main/labs/hash')({
  component: HashPage,
});
