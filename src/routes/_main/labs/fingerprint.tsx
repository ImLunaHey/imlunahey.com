import { createFileRoute } from '@tanstack/react-router';
import FingerprintPage from '../../../pages/labs/Fingerprint';

export const Route = createFileRoute('/_main/labs/fingerprint')({
  component: FingerprintPage,
});
