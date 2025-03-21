import { useRouter } from './use-router';

export const Redirect = ({ to }: { to: string }) => {
  const router = useRouter();
  router.navigate(to);

  return null;
};
