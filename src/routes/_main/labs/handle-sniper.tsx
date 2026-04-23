import { createFileRoute } from '@tanstack/react-router';
import HandleSniperPage from '../../../pages/labs/HandleSniper';

export const Route = createFileRoute('/_main/labs/handle-sniper')({
  component: HandleSniperPage,
});
