import { AtpAgent } from '@atproto/api';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'logging-in' | 'uploading-pdf' | 'uploading-preview' | 'writing-record' | 'done' | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'ready',
  'logging-in': 'logging in',
  'uploading-pdf': 'uploading pdf',
  'uploading-preview': 'uploading preview',
  'writing-record': 'writing record',
  done: 'done',
  error: 'error',
};

async function generatePdfPreview(file: File): Promise<Blob> {
  const { resolvePDFJS } = await import('pdfjs-serverless');
  const { getDocument } = await resolvePDFJS();
  const buf = await file.arrayBuffer();
  const pdf = await getDocument(buf).promise;
  const page = await pdf.getPage(1);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas 2d context');

  const source = page.getViewport({ scale: 1 });
  const targetWidth = 1920;
  const scale = targetWidth / source.width;
  const viewport = page.getViewport({ scale });

  canvas.width = targetWidth;
  canvas.height = Math.round(targetWidth * (9 / 16));

  await page.render({
    canvasContext: ctx,
    viewport,
    transform: [1, 0, 0, 1, 0, 0],
    // @ts-expect-error — clippingPath isn't in the types
    clippingPath: new Path2D().rect(0, 0, canvas.width, canvas.height),
  }).promise;

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!blob) throw new Error('canvas.toBlob returned null');
  return blob;
}

export default function PdfUploaderPage() {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<string>('');
  const [viewLink, setViewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = async (f: File) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      const blob = await generatePdfPreview(f);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void pickFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === 'application/pdf') void pickFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setPhase('error');
      setMsg('pick a pdf first.');
      return;
    }
    setViewLink(null);
    setMsg('');
    try {
      setPhase('logging-in');
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      await agent.login({ identifier: handle.trim(), password: appPassword });

      setPhase('uploading-pdf');
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const pdfBlob = await agent.uploadBlob(pdfBytes, { encoding: 'application/pdf' });

      setPhase('uploading-preview');
      const preview = await generatePdfPreview(file);
      const previewBytes = new Uint8Array(await preview.arrayBuffer());
      await agent.uploadBlob(previewBytes, { encoding: 'image/jpeg' });

      setPhase('writing-record');
      await agent.api.com.atproto.repo.putRecord({
        repo: agent.session!.did,
        collection: 'com.imlunahey.pdf',
        rkey: crypto.randomUUID(),
        record: {
          $type: 'com.imlunahey.pdf',
          pdf: {
            $type: 'blob',
            ref: pdfBlob.data.blob.ref,
            mimeType: 'application/pdf',
            size: pdfBlob.data.blob.size,
          },
        },
      });

      const cid = pdfBlob.data.blob.ref.toString();
      const link = `${agent.service}xrpc/com.atproto.sync.getBlob?did=${agent.session!.did}&cid=${cid}`;
      setViewLink(link);
      setPhase('done');
      setMsg(`uploaded to ${agent.session!.handle}`);
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const copyLink = async () => {
    if (!viewLink) return;
    try {
      await navigator.clipboard.writeText(viewLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-pdf">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">pdf-uploader</span>
        </div>

        <header className="pdf-hd">
          <h1>
            pdf uploader<span className="dot">.</span>
          </h1>
          <p className="sub">
            upload a pdf to your bluesky pds as a <code className="inline">com.imlunahey.pdf</code> record, plus a 16:9
            jpeg preview. renders the first page with <code className="inline">pdfjs-serverless</code> on a canvas; the
            blob ref points at the raw pdf on your own repo.
          </p>
          <div className="warn">
            <b>heads up:</b> this uses a bluesky <b>app password</b>. generate one at{' '}
            <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer" className="t-accent">
              bsky.app/settings/app-passwords
            </a>{' '}
            — never paste your main password.
          </div>
        </header>

        <form onSubmit={submit} className="pdf-form">
          <div className="row">
            <label className="lbl">
              <span>handle</span>
              <input
                className="inp"
                type="text"
                placeholder="user.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="lbl">
              <span>app password</span>
              <input
                className="inp"
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
          </div>

          <label
            className={'dropzone' + (file ? ' has-file' : '')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="pdf preview" className="preview" />
            ) : (
              <div className="dz-body">
                <div className="dz-icon">◱</div>
                <div className="dz-ttl">{file ? file.name : 'drop a pdf here'}</div>
                <div className="dz-sub">{file ? `${(file.size / 1024).toFixed(0)} kb` : 'or click to browse'}</div>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
              className="file-input"
              required
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={busy} className="go">
              {busy ? `${PHASE_LABEL[phase]}…` : 'post to bluesky'}
            </button>
            <span className="t-faint">
              phase · <b className={`ph ph-${phase}`}>{PHASE_LABEL[phase]}</b>
            </span>
          </div>
        </form>

        {(msg || viewLink) && (
          <section className={`status ${phase === 'error' ? 'is-error' : ''}`}>
            {msg ? <div className="msg">{msg}</div> : null}
            {viewLink ? (
              <div className="link">
                <span className="link-lbl">blob link</span>
                <a className="link-url" href={viewLink} target="_blank" rel="noopener noreferrer">
                  {viewLink}
                </a>
                <button type="button" className={'copy' + (copied ? ' flash' : '')} onClick={copyLink}>
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
            ) : null}
          </section>
        )}

        <footer className="pdf-footer">
          <span>
            src: <span className="t-accent">pdfjs-serverless · @atproto/api · com.imlunahey.pdf</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">
              all labs
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-pdf { max-width: 780px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-6);
    margin-bottom: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .crumbs .last { color: var(--color-accent); }

  .pdf-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .pdf-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .pdf-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .pdf-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .pdf-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }
  .warn {
    margin-top: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 5%, var(--color-bg-panel));
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    line-height: 1.55;
  }
  .warn b { color: var(--color-warn); font-weight: 400; }

  .pdf-form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-6) 0;
  }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  .lbl {
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .inp {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: 8px 12px;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }

  .dropzone {
    position: relative;
    display: block;
    min-height: 240px;
    padding: var(--sp-5);
    border: 1px dashed var(--color-border-bright);
    background: var(--color-bg-panel);
    cursor: pointer;
    overflow: hidden;
    text-align: center;
  }
  .dropzone:hover { border-color: var(--color-accent-dim); }
  .dropzone.has-file { border-style: solid; border-color: var(--color-accent-dim); }
  .file-input {
    position: absolute; inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%; height: 100%;
  }
  .dz-body { display: flex; flex-direction: column; gap: 6px; padding: var(--sp-6) 0; align-items: center; }
  .dz-icon { font-size: 40px; color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); line-height: 1; }
  .dz-ttl { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg); }
  .dz-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .preview {
    display: block;
    max-width: 100%;
    max-height: 360px;
    margin: 0 auto;
    border: 1px solid var(--color-border);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    flex-wrap: wrap;
  }
  .go {
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 18px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .go:hover { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .go:disabled { opacity: 0.5; cursor: wait; }
  .ph { color: var(--color-fg); font-weight: 400; }
  .ph.ph-error { color: var(--color-alert); }
  .ph.ph-done { color: var(--color-accent); }

  .status {
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    display: flex; flex-direction: column; gap: var(--sp-3);
  }
  .status.is-error { border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .status .msg { line-height: 1.55; word-break: break-word; }
  .status.is-error .msg { color: var(--color-alert); }

  .link { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
  .link-lbl { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.14em; }
  .link-url {
    color: var(--color-accent);
    font-size: var(--fs-xs);
    text-decoration: none;
    word-break: break-all;
    border-bottom: 1px dashed var(--color-accent-dim);
    flex: 1; min-width: 0;
  }
  .link-url:hover { border-bottom-style: solid; }
  .copy {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit; font-size: 10px;
    padding: 2px 10px; cursor: pointer;
    font-family: var(--font-mono);
  }
  .copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }

  .pdf-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 560px) {
    .row { grid-template-columns: 1fr; }
  }
`;
