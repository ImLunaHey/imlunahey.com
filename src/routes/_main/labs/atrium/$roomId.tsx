import { createFileRoute, useParams } from '@tanstack/react-router';
import AtriumPage from '../../../../pages/labs/Atrium';
import { pageMeta } from '../../../../lib/og-meta';

function RoomedAtrium() {
  const { roomId } = useParams({ strict: false }) as { roomId: string };
  return <AtriumPage roomId={roomId} />;
}

export const Route = createFileRoute('/_main/labs/atrium/$roomId')({
  component: RoomedAtrium,
  head: () => pageMeta('lab/atrium'),
});
