import type { ReactNode } from 'react';
import { createElement } from 'react';

/**
 * Tiny JS/TS/JSON syntax highlighter. Not a parser — a tokenizer that covers
 * keywords, strings, numbers, comments, properties, punctuation. Good enough
 * for scannable output. Pair with css classes .hl-k .hl-s .hl-n .hl-c .hl-p
 * .hl-i .hl-f .hl-ws .hl-x (unknown).
 */
const JS_KEYWORDS = new Set([
  'await', 'async', 'const', 'let', 'var', 'function', 'return', 'if', 'else',
  'for', 'while', 'true', 'false', 'null', 'undefined', 'new', 'import', 'from',
  'export', 'default', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
]);

export function highlightJs(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (cls: string, text: string) => {
    out.push(createElement('span', { key: key++, className: cls }, text));
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const to = end === -1 ? src.length : end;
      push('hl-c', src.slice(i, to));
      i = to;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      // JSON keys look like "foo": — so if the next non-whitespace char is a colon,
      // treat as a property key instead of a string.
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === ':' && c === '"') {
        push('hl-pk', src.slice(i, j));
      } else {
        push('hl-s', src.slice(i, j));
      }
      i = j;
      continue;
    }
    if (/\d/.test(c) || (c === '-' && /\d/.test(src[i + 1]))) {
      let j = i + (c === '-' ? 1 : 0);
      while (j < src.length && /[\d._eE+-]/.test(src[j])) j++;
      push('hl-n', src.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (JS_KEYWORDS.has(word)) push('hl-k', word);
      else if (src[j] === '(') push('hl-f', word);
      else push('hl-i', word);
      i = j;
      continue;
    }
    if (/[{}[\](),;:=<>!?&|+\-*\/%.]/.test(c)) {
      push('hl-p', c);
      i++;
      continue;
    }
    let j = i;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (j > i) { push('hl-ws', src.slice(i, j)); i = j; continue; }
    push('hl-x', c);
    i++;
  }
  return out;
}

/** Common CSS to embed in a lab that uses highlightJs. */
export const HL_CSS = `
  .hl-k { color: #bf8cff; }
  .hl-s { color: #e9a074; }
  .hl-pk { color: var(--color-accent); }
  .hl-n { color: #7cd3f7; }
  .hl-c { color: var(--color-fg-faint); font-style: italic; }
  .hl-f { color: var(--color-accent); }
  .hl-i { color: var(--color-fg); }
  .hl-p { color: var(--color-fg-dim); }
  .hl-ws { white-space: pre; }
  .hl-x { color: var(--color-fg-dim); }
`;
