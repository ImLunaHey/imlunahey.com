import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import type { PresenceDO } from './presence-do';

export const presenceBeat = createServerFn({ method: 'POST' })
  .inputValidator((input: { path: string; sid: string }) => input)
  .handler(async ({ data }): Promise<{ count: number }> => {
    const ns = env.PRESENCE_DO as DurableObjectNamespace<PresenceDO>;
    const id = ns.idFromName(data.path);
    const stub = ns.get(id);
    const count = await stub.beat(data.sid);
    return { count };
  });
