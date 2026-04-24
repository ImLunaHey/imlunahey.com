import { Link, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getStreamDetail, type StreamDetail } from '../../server/twitch';

/**
 * Detail page for a single Twitch channel — embedded player (live if
 * on-air, otherwise the offline still), stream metadata if live,
 * channel description, top clips, recent archives.
 */

function fmtViewers(n: number): string {
  if (n >= 10_000) return (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

function fmtDuration(startedAt: string): string {
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function thumbnail(url: string, width: number, height: number): string {
  return url.replace('{width}', String(width)).replace('{height}', String(height));
}

function vodThumb(url: string): string {
  return url.replace('%{width}', '440').replace('%{height}', '248').replace('{width}', '440').replace('{height}', '248');
}

export default function TwitchLiveDetailPage() {
  const { login } = useParams({ strict: false }) as { login: string };
  const [detail, setDetail] = useState<StreamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    setErr('');
    setDetail(null);
    getStreamDetail({ data: { login } })
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [login]);

  // Twitch player embeds require parent domain(s) in an allowlist.
  // Resolve from the live browser hostname so dev + prod both work.
  const [parentHost, setParentHost] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setParentHost(window.location.hostname);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tw">
        <header className="page-hd">
          <div className="label">
            <Link to="/labs/twitch-live" className="crumb">~/labs/twitch-live</Link>
            <span className="crumb-sep"> / </span>
            <span>{login}</span>
          </div>
          <Link to="/labs/twitch-live" className="back">← back to live streams</Link>
        </header>

        {loading ? <div className="loading">loading channel…</div> : null}
        {err ? <div className="err">{err}</div> : null}

        {detail ? (
          <>
            <section className="hero">
              <img className="h-avatar" src={detail.user.profile_image_url} alt="" />
              <div className="h-body">
                <div className="h-kind">
                  {detail.stream ? <span className="h-live">LIVE</span> : <span className="h-offline">offline</span>}
                  {detail.user.broadcaster_type ? <span className="h-type">{detail.user.broadcaster_type}</span> : null}
                  <span className="h-created">joined {detail.user.created_at.slice(0, 10)}</span>
                </div>
                <h1 className="h-name">{detail.user.display_name}</h1>
                <div className="h-login">@{detail.user.login}</div>
                {detail.stream ? (
                  <div className="h-stream">
                    <span className="h-viewers">{fmtViewers(detail.stream.viewer_count)} viewers</span>
                    <span className="h-sep">·</span>
                    <span>{fmtDuration(detail.stream.started_at)} uptime</span>
                    <span className="h-sep">·</span>
                    <span>{detail.stream.game_name || 'just chatting'}</span>
                  </div>
                ) : null}
              </div>
              <a className="h-twitch" href={`https://twitch.tv/${detail.user.login}`} target="_blank" rel="noopener noreferrer">twitch.tv ↗</a>
            </section>

            {detail.stream && parentHost ? (
              <section className="player">
                <iframe
                  title={`twitch · ${detail.user.display_name}`}
                  src={`https://player.twitch.tv/?channel=${detail.user.login}&parent=${parentHost}&autoplay=false`}
                  allowFullScreen
                  className="player-iframe"
                />
              </section>
            ) : null}

            {detail.stream ? (
              <section className="panel">
                <div className="p-hd">now streaming</div>
                <div className="p-body stream-meta">
                  <div className="sm-title">{detail.stream.title}</div>
                  <dl className="sm-fields">
                    <div><dt>game</dt><dd>{detail.stream.game_name || '—'}</dd></div>
                    <div><dt>language</dt><dd>{detail.stream.language || '—'}</dd></div>
                    <div><dt>started</dt><dd>{new Date(detail.stream.started_at).toLocaleString()}</dd></div>
                    {detail.stream.tags.length > 0 ? (
                      <div><dt>tags</dt><dd>{detail.stream.tags.join(', ')}</dd></div>
                    ) : null}
                  </dl>
                </div>
              </section>
            ) : null}

            {detail.channel && !detail.stream ? (
              <section className="panel">
                <div className="p-hd">last stream / channel info</div>
                <div className="p-body stream-meta">
                  <div className="sm-title">{detail.channel.title || '—'}</div>
                  <dl className="sm-fields">
                    <div><dt>game</dt><dd>{detail.channel.game_name || '—'}</dd></div>
                    <div><dt>language</dt><dd>{detail.channel.broadcaster_language || '—'}</dd></div>
                    {detail.channel.tags.length > 0 ? (
                      <div><dt>tags</dt><dd>{detail.channel.tags.join(', ')}</dd></div>
                    ) : null}
                    {detail.channel.content_classification_labels.length > 0 ? (
                      <div><dt>content warnings</dt><dd>{detail.channel.content_classification_labels.join(', ')}</dd></div>
                    ) : null}
                  </dl>
                </div>
              </section>
            ) : null}

            {detail.user.description ? (
              <section className="panel">
                <div className="p-hd">about</div>
                <div className="p-body about">{detail.user.description}</div>
              </section>
            ) : null}

            {detail.clips.length > 0 ? (
              <section className="panel">
                <div className="p-hd">top clips</div>
                <div className="p-body">
                  <div className="clip-grid">
                    {detail.clips.map((c) => (
                      <a key={c.id} className="clip" href={c.url} target="_blank" rel="noopener noreferrer">
                        <div className="clip-thumb">
                          <img src={c.thumbnail_url} alt="" loading="lazy" />
                          <span className="clip-views">{fmtViewers(c.view_count)}</span>
                          <span className="clip-dur">{c.duration.toFixed(1)}s</span>
                        </div>
                        <div className="clip-title" title={c.title}>{c.title}</div>
                        <div className="clip-meta">by {c.creator_name}</div>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {detail.videos.length > 0 ? (
              <section className="panel">
                <div className="p-hd">recent archives</div>
                <div className="p-body">
                  <ul className="vod-list">
                    {detail.videos.map((v) => (
                      <li key={v.id} className="vod-row">
                        <a href={v.url} target="_blank" rel="noopener noreferrer" className="vod-link">
                          <img src={vodThumb(v.thumbnail_url)} alt="" loading="lazy" className="vod-thumb" />
                          <div className="vod-body">
                            <div className="vod-title">{v.title}</div>
                            <div className="vod-meta">{v.published_at.slice(0, 10)} · {v.duration} · {fmtViewers(v.view_count)} views</div>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.twitch.tv/helix</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-tw { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 48px 0 var(--sp-3); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .crumb { color: var(--color-fg-dim); text-decoration: none; }
  .crumb:hover { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
  .crumb-sep { color: var(--color-fg-faint); }
  .back { color: var(--color-accent); font-family: var(--font-mono); font-size: var(--fs-xs); text-decoration: none; }
  .back:hover { text-decoration: underline; }

  .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .err { border-color: var(--color-alert); color: var(--color-alert); }

  .hero { margin-top: var(--sp-5); display: grid; grid-template-columns: 96px 1fr auto; gap: var(--sp-4); align-items: center; padding: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  @media (max-width: 720px) { .hero { grid-template-columns: 72px 1fr; } .h-twitch { grid-column: 1 / -1; justify-self: start; } }
  .h-avatar { width: 96px; height: 96px; border-radius: 50%; border: 1px solid var(--color-border-bright); background: var(--color-bg-raised); }
  @media (max-width: 720px) { .h-avatar { width: 72px; height: 72px; } }
  .h-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .h-kind { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; flex-wrap: wrap; }
  .h-live { background: #e91916; color: #fff; padding: 2px 8px; letter-spacing: 0.1em; }
  .h-offline { border: 1px solid var(--color-border); padding: 2px 8px; color: var(--color-fg-faint); }
  .h-type { border: 1px solid var(--color-accent-dim); color: var(--color-accent); padding: 2px 8px; }
  .h-created { color: var(--color-fg-faint); }
  .h-name { font-family: var(--font-display); font-size: clamp(28px, 5vw, 56px); font-weight: 500; letter-spacing: -0.02em; color: var(--color-fg); line-height: 1; margin-top: 4px; }
  .h-login { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .h-stream { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); margin-top: 6px; display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }
  .h-viewers { color: var(--color-accent); font-variant-numeric: tabular-nums; }
  .h-sep { color: var(--color-fg-faint); }
  .h-twitch { align-self: center; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border: 1px solid var(--color-accent-dim); padding: 6px 12px; white-space: nowrap; }
  .h-twitch:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); text-decoration: none; }

  .player { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: #000; }
  .player-iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; display: block; }

  .panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .p-hd { padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--color-border); }
  .p-body { padding: var(--sp-3) var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.6; }
  .about { white-space: pre-wrap; word-break: break-word; }

  .stream-meta .sm-title { font-family: var(--font-display); font-size: var(--fs-md); color: var(--color-fg); letter-spacing: -0.01em; margin-bottom: var(--sp-2); line-height: 1.4; }
  .sm-fields { display: flex; flex-direction: column; gap: 4px; }
  .sm-fields > div { display: grid; grid-template-columns: 140px 1fr; gap: var(--sp-2); }
  .sm-fields dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .sm-fields dd { color: var(--color-fg); word-break: break-word; }

  .clip-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--sp-3); }
  .clip { display: flex; flex-direction: column; text-decoration: none; color: inherit; gap: 6px; }
  .clip:hover .clip-thumb { border-color: var(--color-accent-dim); }
  .clip-thumb { position: relative; aspect-ratio: 16 / 9; border: 1px solid var(--color-border); background: var(--color-bg-raised); overflow: hidden; }
  .clip-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .clip-views { position: absolute; top: 6px; right: 6px; background: color-mix(in oklch, black 70%, transparent); color: var(--color-fg); font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; }
  .clip-dur { position: absolute; bottom: 6px; right: 6px; background: color-mix(in oklch, black 70%, transparent); color: var(--color-fg); font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; }
  .clip-title { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
  .clip-meta { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); }

  .vod-list { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); }
  .vod-row { border: 1px solid var(--color-border); }
  .vod-link { display: grid; grid-template-columns: 220px 1fr; gap: var(--sp-3); text-decoration: none; color: inherit; padding: 0; }
  @media (max-width: 720px) { .vod-link { grid-template-columns: 120px 1fr; } }
  .vod-link:hover { background: var(--color-bg-raised); }
  .vod-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: var(--color-bg-raised); }
  .vod-body { padding: var(--sp-2) var(--sp-3) var(--sp-2) 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .vod-title { color: var(--color-fg); font-family: var(--font-display); letter-spacing: -0.01em; font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
  .vod-meta { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
