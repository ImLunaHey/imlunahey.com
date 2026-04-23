import { createFileRoute } from '@tanstack/react-router';
import HexDumpPage from '../../../pages/labs/HexDump';

export const Route = createFileRoute('/_main/labs/hex-dump')({
  component: HexDumpPage,
});
