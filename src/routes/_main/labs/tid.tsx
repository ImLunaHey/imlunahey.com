import { createFileRoute } from '@tanstack/react-router';
import TidPage from '../../../pages/labs/Tid';

export const Route = createFileRoute('/_main/labs/tid')({
  component: TidPage,
});
