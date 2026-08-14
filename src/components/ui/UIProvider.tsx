'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from './Toast';
import { TooltipProvider } from './Tooltip';

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={450} skipDelayDuration={180}>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  );
}
