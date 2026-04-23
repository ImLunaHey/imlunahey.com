import { createFileRoute } from '@tanstack/react-router';
import BskyComposerPage from '../../../pages/labs/BskyComposer';

export const Route = createFileRoute('/_main/labs/bsky-composer')({
  component: BskyComposerPage,
});
