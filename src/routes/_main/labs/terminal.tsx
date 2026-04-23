import { createFileRoute } from '@tanstack/react-router';
import TerminalPage from '../../../pages/labs/Terminal';

export const Route = createFileRoute('/_main/labs/terminal')({
  component: TerminalPage,
});
