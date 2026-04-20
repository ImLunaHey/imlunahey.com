import { createFileRoute } from '@tanstack/react-router';
import WhiteWindPage from '../../../pages/WhiteWind';

export const Route = createFileRoute('/_main/whitewind/$rkey')({
  component: WhiteWindPage,
});
