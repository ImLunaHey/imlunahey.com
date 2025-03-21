import { useRouter } from './use-router';

export const useParams = () => {
  const { currentPath } = useRouter();
  return currentPath.split('/').filter(Boolean);
};
