import { createFileRoute, useParams } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

function RoomedAtrium() {
  const { roomId } = useParams({ strict: false }) as { roomId: string };
  // URL-supplied roomId only seeds the initial room. After mount, the
  // URL doesn't change as you walk between rooms — the room is purely
  // internal state, so a refresh drops you back here in this room.
  return <AtriumPage initialRoom={roomId} />;
}

export const Route = createFileRoute('/_main/labs/atrium/$roomId')({
  component: RoomedAtrium,
  head: () => pageMeta('lab/atrium'),
});
