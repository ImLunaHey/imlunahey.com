import { useQuery } from '@tanstack/react-query';
import { readingTime } from 'reading-time-estimator';
import { useBlogEntry } from './use-blog-entry';

export const useReadTime = ({ rkey }: { rkey: string }) => {
  const { data: blogEntry } = useBlogEntry({ author: 'did:plc:k6acu4chiwkixvdedcmdgmal', rkey });
  return useQuery({
    queryKey: ['read-time', rkey],
    queryFn: () => (blogEntry?.value.content ? readingTime(blogEntry.value.content) : undefined),
    enabled: !!blogEntry,
  });
};
