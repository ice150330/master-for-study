'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++nextId.current;
      const item: ToastItem = { ...input, id, tone: input.tone ?? 'info' };
      setToasts((items) => [
        ...items.filter((toast) => toast.title !== item.title || toast.description !== item.description),
        item,
      ].slice(-3));
      window.setTimeout(() => dismiss(id), input.duration ?? 3600);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-[var(--shadow-md)] animate-toast-enter"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-[18px] shrink-0',
                  toast.tone === 'success' && 'text-accent',
                  toast.tone === 'error' && 'text-danger',
                  toast.tone === 'info' && 'text-primary',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                aria-label="关闭通知"
                onClick={() => dismiss(toast.id)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast 必须在 ToastProvider 内使用');
  return push;
}
