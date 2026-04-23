import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Status = { code: number; name: string; desc: string; causes?: string };

const STATUSES: Status[] = [
  { code: 100, name: 'Continue', desc: 'Server has received request headers, client should send the body.' },
  { code: 101, name: 'Switching Protocols', desc: 'Server is switching protocols as requested by the client.', causes: 'WebSocket upgrade.' },
  { code: 102, name: 'Processing', desc: 'Server has received and is processing the request.' },
  { code: 103, name: 'Early Hints', desc: 'Preliminary response for resource hints before the final response.' },

  { code: 200, name: 'OK', desc: 'Request succeeded. The meaning depends on the HTTP method.' },
  { code: 201, name: 'Created', desc: 'Request succeeded and a new resource was created.', causes: 'Typical for POST requests.' },
  { code: 202, name: 'Accepted', desc: 'Request accepted but processing is not complete.' },
  { code: 203, name: 'Non-Authoritative Information', desc: 'Response from a transforming proxy, not the origin.' },
  { code: 204, name: 'No Content', desc: 'Success; no body to return.', causes: 'DELETE, PUT often return this.' },
  { code: 205, name: 'Reset Content', desc: 'Tell the client to reset the document view.' },
  { code: 206, name: 'Partial Content', desc: 'Response body contains only part of the resource.', causes: 'Range requests, resumable downloads.' },
  { code: 207, name: 'Multi-Status', desc: 'WebDAV: body contains multiple status codes.' },
  { code: 208, name: 'Already Reported', desc: 'WebDAV: already enumerated in a prior part of this response.' },
  { code: 226, name: 'IM Used', desc: 'Server applied instance-manipulations to the request.' },

  { code: 300, name: 'Multiple Choices', desc: 'Multiple options for the resource.' },
  { code: 301, name: 'Moved Permanently', desc: 'Resource has a new URL, use it from now on.', causes: 'SEO-friendly redirect.' },
  { code: 302, name: 'Found', desc: 'Resource is temporarily at another URL.', causes: 'Default redirect in many frameworks.' },
  { code: 303, name: 'See Other', desc: 'Client should GET a different URL (changes method to GET).', causes: 'POST-redirect-GET pattern.' },
  { code: 304, name: 'Not Modified', desc: 'Cached version is still fresh; no body.', causes: 'Conditional GET with If-None-Match / If-Modified-Since.' },
  { code: 307, name: 'Temporary Redirect', desc: 'Like 302 but preserves the HTTP method.' },
  { code: 308, name: 'Permanent Redirect', desc: 'Like 301 but preserves the HTTP method.' },

  { code: 400, name: 'Bad Request', desc: 'Request was malformed and could not be understood.' },
  { code: 401, name: 'Unauthorized', desc: 'Authentication required or failed.', causes: 'Missing / invalid auth header.' },
  { code: 402, name: 'Payment Required', desc: 'Reserved for future use (rare in the wild).' },
  { code: 403, name: 'Forbidden', desc: 'Server understands but refuses to authorize.', causes: 'Insufficient permissions, rate-limit (sometimes), geo-block.' },
  { code: 404, name: 'Not Found', desc: 'Resource does not exist at that URL.' },
  { code: 405, name: 'Method Not Allowed', desc: 'The method is known but not supported by this resource.', causes: 'Trying POST on a read-only endpoint.' },
  { code: 406, name: 'Not Acceptable', desc: 'Server cannot produce a response matching the Accept headers.' },
  { code: 407, name: 'Proxy Authentication Required', desc: 'Client must authenticate with the proxy.' },
  { code: 408, name: 'Request Timeout', desc: 'Server timed out waiting for the client.' },
  { code: 409, name: 'Conflict', desc: 'Request conflicts with the current state of the resource.', causes: 'Edit conflicts, unique constraint violations.' },
  { code: 410, name: 'Gone', desc: 'Resource intentionally no longer exists.' },
  { code: 411, name: 'Length Required', desc: 'Server requires a Content-Length header.' },
  { code: 412, name: 'Precondition Failed', desc: 'A precondition in the request headers was not met.' },
  { code: 413, name: 'Payload Too Large', desc: 'Request body is too big.', causes: 'Upload limits.' },
  { code: 414, name: 'URI Too Long', desc: 'URL is too long for the server to handle.' },
  { code: 415, name: 'Unsupported Media Type', desc: 'Server cannot accept the request body format.' },
  { code: 416, name: 'Range Not Satisfiable', desc: 'Range header asks for a portion outside the resource.' },
  { code: 417, name: 'Expectation Failed', desc: 'Server cannot meet the Expect header requirements.' },
  { code: 418, name: "I'm a teapot", desc: 'RFC 2324 joke — short and stout.', causes: 'Easter eggs, sometimes used for bot deterrence.' },
  { code: 421, name: 'Misdirected Request', desc: 'Request sent to a server that cannot produce a response.' },
  { code: 422, name: 'Unprocessable Content', desc: 'Semantic errors in a well-formed request.', causes: 'Validation failures.' },
  { code: 423, name: 'Locked', desc: 'WebDAV: resource is locked.' },
  { code: 424, name: 'Failed Dependency', desc: 'WebDAV: request failed due to a prior request failing.' },
  { code: 425, name: 'Too Early', desc: 'Server is unwilling to risk processing a replayable request.' },
  { code: 426, name: 'Upgrade Required', desc: 'Client should switch to a different protocol.' },
  { code: 428, name: 'Precondition Required', desc: 'Origin requires the request to be conditional.' },
  { code: 429, name: 'Too Many Requests', desc: 'Rate-limited.', causes: 'Check Retry-After header.' },
  { code: 431, name: 'Request Header Fields Too Large', desc: 'Headers exceed server limits.' },
  { code: 451, name: 'Unavailable For Legal Reasons', desc: 'Resource removed due to legal demand.', causes: 'Court order, government takedown.' },

  { code: 500, name: 'Internal Server Error', desc: 'Generic error — something went wrong on the server.' },
  { code: 501, name: 'Not Implemented', desc: 'Server does not support the request method.' },
  { code: 502, name: 'Bad Gateway', desc: 'Gateway or proxy got an invalid response from upstream.', causes: 'Upstream crashed or unreachable.' },
  { code: 503, name: 'Service Unavailable', desc: 'Server is overloaded or down for maintenance.' },
  { code: 504, name: 'Gateway Timeout', desc: 'Gateway did not receive a timely response from upstream.' },
  { code: 505, name: 'HTTP Version Not Supported', desc: 'Server does not support the requested HTTP version.' },
  { code: 506, name: 'Variant Also Negotiates', desc: 'Content negotiation cycle / misconfigured.' },
  { code: 507, name: 'Insufficient Storage', desc: 'WebDAV: server cannot store the representation.' },
  { code: 508, name: 'Loop Detected', desc: 'WebDAV: infinite loop detected while processing.' },
  { code: 510, name: 'Not Extended', desc: 'Further extensions to the request are required.' },
  { code: 511, name: 'Network Authentication Required', desc: 'Client must authenticate to gain network access.', causes: 'Captive portals.' },
];

const CATEGORIES = [
  { id: '1', name: 'informational', from: 100, to: 199 },
  { id: '2', name: 'success', from: 200, to: 299 },
  { id: '3', name: 'redirect', from: 300, to: 399 },
  { id: '4', name: 'client error', from: 400, to: 499 },
  { id: '5', name: 'server error', from: 500, to: 599 },
] as const;

type Cat = typeof CATEGORIES[number]['id'] | 'all';

export default function HttpStatusPage() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return STATUSES.filter((s) => {
      if (cat !== 'all' && String(s.code)[0] !== cat) return false;
      if (!query) return true;
      return (
        String(s.code).includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.desc.toLowerCase().includes(query) ||
        (s.causes ?? '').toLowerCase().includes(query)
      );
    });
  }, [q, cat]);

  const catOf = (code: number): Cat => (String(code)[0] as Cat);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hs">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">http status</span>
        </div>

        <header className="hs-hd">
          <h1>http status<span className="dot">.</span></h1>
          <p className="sub">
            every http status code with a plain-english description and common causes. search by
            number, name, or a phrase in the description.
          </p>
        </header>

        <section className="hs-filters">
          <input
            className="hs-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="404, rate, redirect…"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="hs-cats">
            <button className={`hs-cat ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
              all <span className="ct">{STATUSES.length}</span>
            </button>
            {CATEGORIES.map((c) => {
              const count = STATUSES.filter((s) => catOf(s.code) === c.id).length;
              return (
                <button
                  key={c.id}
                  className={`hs-cat c-${c.id} ${cat === c.id ? 'on' : ''}`}
                  onClick={() => setCat(c.id)}
                >{c.id}xx · {c.name} <span className="ct">{count}</span></button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <div className="hs-empty">no matches</div>
          ) : (
            <div className="hs-count">{filtered.length} of {STATUSES.length}</div>
          )}
        </section>

        <section className="hs-grid">
          {filtered.map((s) => (
            <article key={s.code} className={`hs-card c-${catOf(s.code)}`}>
              <header className="hs-card-hd">
                <span className="hs-code">{s.code}</span>
                <span className="hs-name">{s.name}</span>
                <a
                  className="hs-cat-link"
                  href={`https://http.cat/${s.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="http.cat image"
                >🐱</a>
              </header>
              <p className="hs-desc">{s.desc}</p>
              {s.causes ? <p className="hs-causes"><b>common causes:</b> {s.causes}</p> : null}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

const CSS = `
  .shell-hs { max-width: 1180px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .hs-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .hs-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .hs-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .hs-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .hs-filters {
    padding: var(--sp-4) 0;
    display: flex; flex-direction: column; gap: var(--sp-2);
  }
  .hs-search {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    outline: 0;
  }
  .hs-search:focus { border-color: var(--color-accent-dim); }
  .hs-cats {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .hs-cat {
    display: inline-flex; gap: 6px; align-items: center;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 3px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .hs-cat:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .hs-cat.on { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .hs-cat .ct { color: var(--color-fg-ghost); font-size: 10px; }
  .hs-count {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .hs-empty {
    padding: var(--sp-5);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    border: 1px dashed var(--color-border);
  }

  .hs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--sp-2);
    padding-bottom: var(--sp-10);
  }
  .hs-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 6px;
    border-left-width: 3px;
  }
  .hs-card.c-1 { border-left-color: #7cd3f7; }
  .hs-card.c-2 { border-left-color: var(--color-accent); }
  .hs-card.c-3 { border-left-color: var(--color-warn); }
  .hs-card.c-4 { border-left-color: #ff9944; }
  .hs-card.c-5 { border-left-color: var(--color-alert); }

  .hs-card-hd {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .hs-code {
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    font-weight: 500;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .hs-card.c-2 .hs-code { color: var(--color-accent); }
  .hs-card.c-3 .hs-code { color: var(--color-warn); }
  .hs-card.c-4 .hs-code { color: #ff9944; }
  .hs-card.c-5 .hs-code { color: var(--color-alert); }
  .hs-name {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
  }
  .hs-cat-link {
    margin-left: auto;
    color: var(--color-fg-faint);
    text-decoration: none;
    font-size: var(--fs-md);
    opacity: 0.6;
  }
  .hs-cat-link:hover { opacity: 1; }

  .hs-desc {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    line-height: 1.5;
  }
  .hs-causes {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    line-height: 1.5;
    padding: 6px 8px;
    background: var(--color-bg);
    border: 1px dashed var(--color-border);
  }
  .hs-causes b { color: var(--color-fg); font-weight: 400; }
`;
