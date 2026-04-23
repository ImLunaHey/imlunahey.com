import { createFileRoute } from '@tanstack/react-router';
import RegexPage from '../../../pages/labs/Regex';

export const Route = createFileRoute('/_main/labs/regex')({
  component: RegexPage,
});
