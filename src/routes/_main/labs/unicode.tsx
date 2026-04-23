import { createFileRoute } from '@tanstack/react-router';
import UnicodePage from '../../../pages/labs/Unicode';

export const Route = createFileRoute('/_main/labs/unicode')({
  component: UnicodePage,
});
