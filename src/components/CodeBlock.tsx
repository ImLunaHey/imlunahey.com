import { useState } from 'react';
import { highlight } from 'sugar-high';

type Props = {
  /** Raw source — will be syntax-highlighted client-side. */
  code: string;
  /** Label shown in the top bar, e.g. `src / Foo.tsx`. Supports one emphasised span via {b: '...'}. */
  filename?: string;
  /** Hide the top bar with filename + copy button. */
  bare?: boolean;
  /** Override the highlighter. Defaults to `tsx` (sugar-high); `json` uses a key-aware tokenizer. */
  language?: 'tsx' | 'json';
};

export function CodeBlock({ code, filename, bare, language = 'tsx' }: Props) {
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
        <code
          className="cb-code"
          dangerouslySetInnerHTML={{ __html: language === 'json' ? highlightJson(code) : highlight(code) }}
        />
      </pre>
    </div>
  );
}

// minimal json tokenizer — emits spans styled by the same --sh-* css vars
// sugar-high uses, so the two highlighters share the phosphor palette.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

function highlightJson(src: string): string {
  const out: string[] = [];
  const push = (varName: string, text: string) => {
    out.push(`<span style="color:var(--sh-${varName})">${escapeHtml(text)}</span>`);
  };

  let i = 0;
  const len = src.length;
  while (i < len) {
    const ch = src[i];

    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      let j = i;
      while (j < len && (src[j] === ' ' || src[j] === '\n' || src[j] === '\t' || src[j] === '\r')) j++;
      out.push(escapeHtml(src.slice(i, j)));
      i = j;
      continue;
    }

    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ',' || ch === ':') {
      push('sign', ch);
      i++;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < len) {
        if (src[j] === '\\' && j + 1 < len) {
          j += 2;
          continue;
        }
        if (src[j] === '"') break;
        j++;
      }
      j++; // consume closing quote (if present)
      const str = src.slice(i, j);
      // peek: is next non-whitespace a colon? then this is a key
      let k = j;
      while (k < len && (src[k] === ' ' || src[k] === '\n' || src[k] === '\t' || src[k] === '\r')) k++;
      const isKey = src[k] === ':';
      push(isKey ? 'property' : 'string', str);
      i = j;
      continue;
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < len && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.' || src[j] === 'e' || src[j] === 'E' || src[j] === '+' || src[j] === '-')) j++;
      push('entity', src.slice(i, j));
      i = j;
      continue;
    }

    if (src.startsWith('true', i)) {
      push('keyword', 'true');
      i += 4;
      continue;
    }
    if (src.startsWith('false', i)) {
      push('keyword', 'false');
      i += 5;
      continue;
    }
    if (src.startsWith('null', i)) {
      push('keyword', 'null');
      i += 4;
      continue;
    }

    out.push(escapeHtml(ch));
    i++;
  }

  return out.join('');
}

// phosphor-green palette for sugar-high tokens
// see: https://sugar-high.vercel.app
const CSS = `
  .cb {
    --sh-identifier: var(--color-fg);
    --sh-keyword:    oklch(0.78 0.16 315);   /* magenta — const, return, import */
    --sh-string:     oklch(0.82 0.13 85);    /* amber  — "strings" */
    --sh-class:      oklch(0.85 0.14 65);    /* yellow — classes / types */
    --sh-property:   oklch(0.78 0.11 210);   /* cyan   — obj.properties */
    --sh-entity:     var(--color-accent);    /* phosphor — fn calls, jsx tags */
    --sh-jsxliterals:oklch(0.78 0.11 210);   /* cyan   — jsx braces */
    --sh-sign:       var(--color-fg-faint);  /* punctuation */
    --sh-comment:    var(--color-fg-faint);  /* // comments */
    --sh-break:      var(--color-fg);
    --sh-space:      transparent;

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
  .sh__token--comment { font-style: italic; }
`;
