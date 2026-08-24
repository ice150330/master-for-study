import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses =
  'paper-subtle w-full rounded-[2px] border-2 border-dashed px-3 text-sm text-card-foreground outline-none transition-[transform,border-color,box-shadow,background-color] duration-150 placeholder:text-muted hover:border-foreground/50 hover:bg-card focus:-translate-x-px focus:-translate-y-px focus:border-accent focus:bg-card focus:shadow-[4px_4px_0_rgba(78,205,196,0.38)] aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[3px_3px_0_rgba(255,107,107,0.32)] disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClasses, 'h-8', className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(controlClasses, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
        {...props}
      />
    );
  },
);
