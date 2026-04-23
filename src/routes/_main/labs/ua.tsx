import { createFileRoute } from '@tanstack/react-router';
import UaPage from '../../../pages/labs/Ua';

export const Route = createFileRoute('/_main/labs/ua')({
  component: UaPage,
});
