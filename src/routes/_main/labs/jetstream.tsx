import { createFileRoute } from '@tanstack/react-router';
import JetstreamPage from '../../../pages/labs/Jetstream';

export const Route = createFileRoute('/_main/labs/jetstream')({
  component: JetstreamPage,
});
