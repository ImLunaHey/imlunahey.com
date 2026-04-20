import { createFileRoute } from '@tanstack/react-router';
import DesignPage from '../../pages/Design';

export const Route = createFileRoute('/_main/design')({
  component: DesignPage,
});
