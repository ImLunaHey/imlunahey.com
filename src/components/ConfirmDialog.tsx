import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ConfirmVariant = 'default' | 'danger';

type ConfirmOpts = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

type PendingState = ConfirmOpts & { resolve: (v: boolean) => void };

/** Returns a `confirm(opts) → Promise<boolean>` plus a `dialog` node to render in your tree. */
export function useConfirm() {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((p) => {
        if (p) p.resolve(result);
        return null;
      });
    },
    [],
  );

  const dialog = pending ? <Dialog pending={pending} onClose={close} /> : null;

  return { confirm, dialog };
}

function Dialog({ pending, onClose }: { pending: PendingState; onClose: (r: boolean) => void }) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      // guard — the opener may have unmounted while the dialog was up
      // (e.g. a confirm fired from a row that disappears on resolve).
      const prev = previousFocus.current;
      if (prev && document.contains(prev)) prev.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose(false);
      } else if (e.key === 'Enter') {
        // Enter resolves only when no input/textarea has focus (user is typing)
        const tag = (document.activeElement?.tagName ?? '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          onClose(true);
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const { title, body, confirmLabel = 'confirm', cancelLabel = 'cancel', variant = 'default' } = pending;

  const node = (
    <>
      <style>{CSS}</style>
      <div
        className="cd-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-body"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose(false);
        }}
      >
        <div className={'cd-panel' + (variant === 'danger' ? ' is-danger' : '')}>
          <div className="cd-head">// {variant === 'danger' ? 'confirm — destructive' : 'confirm'}</div>
          <div className="cd-body">
            <h2 id="cd-title" className="cd-title">
              {title}
            </h2>
            {body ? (
              <div id="cd-body" className="cd-msg">
                {body}
              </div>
            ) : null}
          </div>
          <div className="cd-actions">
            <button type="button" className="cd-btn cd-cancel" onClick={() => onClose(false)}>
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              className={'cd-btn cd-confirm' + (variant === 'danger' ? ' is-danger' : '')}
              onClick={() => onClose(true)}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

const CSS = `
  .cd-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in oklch, var(--color-bg) 85%, transparent);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-6);
    animation: cd-fade 0.12s ease-out;
  }
  @keyframes cd-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .cd-panel {
    position: relative;
    width: 100%;
    max-width: 440px;
    border: 1px solid var(--color-accent-dim);
    background: var(--color-bg-panel);
    box-shadow: 0 0 40px color-mix(in oklch, var(--color-accent) 18%, transparent),
                0 20px 60px rgba(0, 0, 0, 0.8);
    font-family: var(--font-mono);
    animation: cd-rise 0.14s ease-out;
  }
  .cd-panel.is-danger {
    border-color: color-mix(in oklch, var(--color-alert) 50%, var(--color-border));
    box-shadow: 0 0 40px color-mix(in oklch, var(--color-alert) 18%, transparent),
                0 20px 60px rgba(0, 0, 0, 0.8);
  }
  .cd-panel::before {
    content: "";
    position: absolute; top: -1px; left: -1px;
    width: 14px; height: 14px;
    border-left: 1px solid var(--color-accent);
    border-top: 1px solid var(--color-accent);
  }
  .cd-panel::after {
    content: "";
    position: absolute; bottom: -1px; right: -1px;
    width: 14px; height: 14px;
    border-right: 1px solid var(--color-accent);
    border-bottom: 1px solid var(--color-accent);
  }
  .cd-panel.is-danger::before { border-left-color: var(--color-alert); border-top-color: var(--color-alert); }
  .cd-panel.is-danger::after  { border-right-color: var(--color-alert); border-bottom-color: var(--color-alert); }

  @keyframes cd-rise {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cd-head {
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-size: 10px;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .cd-panel.is-danger .cd-head { color: var(--color-alert); }

  .cd-body {
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .cd-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1.2;
  }
  .cd-msg {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    font-family: var(--font-mono);
  }

  .cd-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-5) var(--sp-4);
    border-top: 1px solid var(--color-border);
  }
  .cd-btn {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 6px 16px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .cd-cancel:hover { color: var(--color-fg); border-color: var(--color-fg-faint); }
  .cd-confirm {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
  }
  .cd-confirm:hover { background: color-mix(in oklch, var(--color-accent) 18%, var(--color-bg-panel)); }
  .cd-confirm:focus-visible { outline: 1px solid var(--color-accent); outline-offset: 2px; }
  .cd-confirm.is-danger {
    border-color: color-mix(in oklch, var(--color-alert) 50%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 10%, var(--color-bg-panel));
    color: var(--color-alert);
  }
  .cd-confirm.is-danger:hover { background: color-mix(in oklch, var(--color-alert) 20%, var(--color-bg-panel)); }
  .cd-confirm.is-danger:focus-visible { outline-color: var(--color-alert); }
`;
