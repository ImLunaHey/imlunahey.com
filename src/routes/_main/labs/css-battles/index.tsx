import { createFileRoute } from '@tanstack/react-router';
import CssBattlesPage from '../../../../pages/labs/CssBattles';

export const Route = createFileRoute('/_main/labs/css-battles/')({
  component: CssBattlesPage,
});
