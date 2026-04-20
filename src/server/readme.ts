import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';
import { authHeaders } from './github';

type ReadmeResp = {
  content: string;
  encoding: 'base64';
  html_url: string;
};

export const getReadme = createServerFn({ method: 'GET' })
  .inputValidator((input: { owner: string; name: string }) => input)
  .handler(({ data }): Promise<string | null> =>
    cached(`readme:${data.owner}/${data.name}`, TTL.long, async () => {
      const res = await fetch(`https://api.github.com/repos/${data.owner}/${data.name}/readme`, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as ReadmeResp;
      if (body.encoding !== 'base64') return null;
      try {
        return Buffer.from(body.content, 'base64').toString('utf8');
      } catch {
        return null;
      }
    }),
  );
