import { createFileRoute } from '@tanstack/react-router';
import AudioExtractorPage from '../../../pages/labs/AudioExtractor';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/audio-extractor')({
  component: AudioExtractorPage,
  head: () => pageMeta('lab/audio-extractor'),
});
