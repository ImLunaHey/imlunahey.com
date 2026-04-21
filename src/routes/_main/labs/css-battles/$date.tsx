import { createFileRoute } from '@tanstack/react-router';
import CssBattlePage from '../../../../pages/labs/CssBattle';

export const Route = createFileRoute('/_main/labs/css-battles/$date')({
  component: CssBattlePage,
});
