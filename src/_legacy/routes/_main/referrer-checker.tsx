import { createFileRoute } from '@tanstack/react-router';
import ReferrerCheckerPage from '../../pages/ReferrerChecker';

export const Route = createFileRoute('/_main/referrer-checker')({
  component: ReferrerCheckerPage,
});
