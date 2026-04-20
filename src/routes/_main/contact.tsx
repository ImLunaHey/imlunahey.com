import { createFileRoute } from '@tanstack/react-router';
import ContactPage from '../../pages/Contact';

export const Route = createFileRoute('/_main/contact')({
  component: ContactPage,
});
