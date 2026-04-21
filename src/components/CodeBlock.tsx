import { useState } from 'react';
import { highlight } from 'sugar-high';

type Props = {
  /** Raw source — will be syntax-highlighted client-side. */
  code: string;
  /** Label shown in the top bar, e.g. `src / Foo.tsx`. Supports one emphasised span via {b: '...'}. */
  filename?: string;
  /** Hide the top bar with filename + copy button. */
  bare?: boolean;
};

export function CodeBlock({ code, filename, bare }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="cb">
      <style>{CSS}</style>
      {bare ? null : (
        <div className="cb-top">
          <span className="cb-name">{filename ?? 'snippet'}</span>
          <button type="button" className={'cb-copy' + (copied ? ' flash' : '')} onClick={copy}>
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      )}
      <pre className="cb-pre">
        <code className="cb-code" dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </div>
  );
}

// phosphor-green palette for sugar-high tokens
// see: https://sugar-high.vercel.app
const CSS = `
  .cb {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .cb-top {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .cb-name b { color: var(--color-accent-dim); font-weight: 400; }
  .cb-copy {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-size: 10px;
    padding: 2px 10px;
    cursor: pointer;
    text-transform: lowercase;
    font-family: var(--font-mono);
  }
  .cb-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .cb-copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }
  .cb-pre {
    margin: 0;
    padding: var(--sp-4) var(--sp-5);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-fg);
  }
  .cb-code { font-family: inherit; background: transparent; border: 0; padding: 0; color: inherit; white-space: pre; }

  /* sugar-high token theme — phosphor-green */
  .sh__token--identifier { color: var(--color-fg); }
  .sh__token--keyword    { color: oklch(0.78 0.16 315); }                /* magenta-ish — keywords (const, return, import) */
  .sh__token--string     { color: oklch(0.82 0.13 85); }                 /* amber — strings */
  .sh__token--class      { color: oklch(0.85 0.14 65); }                 /* yellow-orange — classes / types */
  .sh__token--property   { color: oklch(0.78 0.11 210); }                /* cyan — properties */
  .sh__token--entity     { color: var(--color-accent); }                 /* phosphor — fn / jsx tags */
  .sh__token--jsxliterals{ color: oklch(0.78 0.11 210); }                /* cyan — jsx braces */
  .sh__token--sign       { color: var(--color-fg-faint); }               /* punctuation */
  .sh__token--comment    { color: var(--color-fg-faint); font-style: italic; }
  .sh__token--break      { color: var(--color-fg); }
  .sh__token--space      { color: inherit; }
`;
