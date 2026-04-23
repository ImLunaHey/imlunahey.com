import { createFileRoute } from '@tanstack/react-router';
import IdsPage from '../../../pages/labs/Ids';

export const Route = createFileRoute('/_main/labs/ids')({
  component: IdsPage,
});
