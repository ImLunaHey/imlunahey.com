import { createFileRoute } from '@tanstack/react-router';
import SpectrogramPage from '../../../pages/labs/Spectrogram';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/spectrogram')({
  component: SpectrogramPage,
  head: () => pageMeta('lab/spectrogram'),
});
