import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Toasts e diálogos de confirmação.
 * Substituem window.alert / window.confirm / window.prompt, que travam
 * a aba, não seguem o visual do sistema e não funcionam bem no celular.
 * ------------------------------------------------------------------ */

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };
type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** Quando informado, o diálogo pede um texto (ex.: motivo da exclusão) e o devolve. */
  input?: { label: string; defaultValue?: string; required?: boolean };
};
type Feedback = {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: ConfirmOptions & { input: NonNullable<ConfirmOptions['input']> }) => Promise<string | null>;
};

const FeedbackCtx = createContext<Feedback | null>(null);

type Pending = { options: ConfirmOptions; resolve: (value: string | boolean | null) => void };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++seq.current;
    setToasts(list => [...list.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  const ask = useCallback((options: ConfirmOptions) => new Promise<string | boolean | null>(resolve => setPending({ options, resolve })), []);
  const confirm = useCallback(async (options: ConfirmOptions) => (await ask(options)) !== null, [ask]);
  const prompt = useCallback(async (options: ConfirmOptions & { input: NonNullable<ConfirmOptions['input']> }) => {
    const value = await ask(options);
    return typeof value === 'string' ? value : null;
  }, [ask]);

  const close = (value: string | boolean | null) => { pending?.resolve(value); setPending(null); };
  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  return <FeedbackCtx.Provider value={value}>
    {children}
    <div className="toast-region" role="region" aria-label="Notificações" aria-live="polite">
      {toasts.map(t => <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
        <span className="toast-dot" aria-hidden="true" />
        <span>{t.message}</span>
        <button type="button" className="toast-close" aria-label="Fechar notificação" onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}>×</button>
      </div>)}
    </div>
    {pending && <ConfirmDialog options={pending.options} onClose={close} />}
  </FeedbackCtx.Provider>;
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (value: string | boolean | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(options.input?.defaultValue ?? '');
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (options.input) {
      if (options.input.required && !text.trim()) return;
      onClose(text.trim());
    } else onClose(true);
  };
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose(null); }}>
    <form method="dialog" onSubmit={submit}>
      <h2 id="dialog-title">{options.title}</h2>
      {options.message && <div className="dialog-body">{options.message}</div>}
      {options.input && <label className="dialog-field">{options.input.label}
        <input autoFocus value={text} required={options.input.required} onChange={e => setText(e.target.value)} />
      </label>}
      <div className="dialog-actions">
        <button type="button" className="ghost" onClick={() => onClose(null)}>{options.cancelLabel ?? 'Cancelar'}</button>
        <button type="submit" className={options.tone === 'danger' ? 'danger solid' : 'primary'} autoFocus={!options.input}>{options.confirmLabel ?? 'Confirmar'}</button>
      </div>
    </form>
  </dialog>;
}

export function useFeedback() {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error('useFeedback deve ser usado dentro de <FeedbackProvider>');
  return ctx;
}
