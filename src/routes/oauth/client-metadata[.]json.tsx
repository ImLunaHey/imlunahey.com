import { createFileRoute } from '@tanstack/react-router';
import { SITE } from '../../data';
import { ALL_SCOPES } from '../../lib/oauth';

/**
 * Dynamic client metadata for atproto oauth.
 *
 * Previously a static file at public/oauth/client-metadata.json that had
 * to be hand-edited every time a new scope was added to lib/oauth.ts.
 * Every third feature we shipped, the static file drifted and the pds
 * silently dropped the un-declared scope at consent time — see the
 * ?action=* bug, the whtwnd bug, the pdf bug, the listblock bug.
 *
 * The route now stamps the scope list straight from ALL_SCOPES. Adding
 * a new scope is a one-file change.
 *
 * Cached for 5 minutes at the edge so pdses don't hammer the worker on
 * every oauth flow, but updates propagate within minutes of deploy.
 */
export const Route = createFileRoute('/oauth/client-metadata.json')({
  server: {
    handlers: {
      GET: () => {
        const origin = `https://${SITE.domain}`;
        const body = JSON.stringify(
          {
            client_id: `${origin}/oauth/client-metadata.json`,
            application_type: 'web',
            client_name: SITE.domain,
            client_uri: origin,
            logo_uri: `${origin}/logo.png`,
            tos_uri: origin,
            policy_uri: origin,
            redirect_uris: [`${origin}/oauth/callback`],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            scope: ALL_SCOPES,
            token_endpoint_auth_method: 'none',
            dpop_bound_access_tokens: true,
          },
          null,
          2,
        );
        return new Response(body, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300, s-maxage=300',
          },
        });
      },
    },
  },
});
