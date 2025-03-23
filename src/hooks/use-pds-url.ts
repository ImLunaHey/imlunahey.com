import { useQuery } from '@tanstack/react-query';

export const usePDSUrl = () => {
  return useQuery({
    queryKey: ['pds-url'],
    queryFn: async () => {
      const pdsUri = await fetch(`https://plc.directory/did:plc:k6acu4chiwkixvdedcmdgmal`)
        .then(
          (response) =>
            response.json() as Promise<{
              service: {
                id: string;
                type: string;
                serviceEndpoint: string;
              }[];
            }>,
        )
        .then((data) => data.service.find((s) => s.id === '#atproto_pds')?.serviceEndpoint);
      if (!pdsUri) throw new Error('PDS URI not found');
      return pdsUri;
    },
  });
};
