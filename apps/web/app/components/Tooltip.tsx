'use client';

import React from 'react';
import { clsx } from 'clsx';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

export default function Tooltip({ label, children, side = 'bottom', className }: TooltipProps) {
  return (
    <div className={clsx('relative inline-flex group/tooltip', className)}>
      {children}
      <div
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 z-[70] whitespace-nowrap rounded-lg bg-input border border-border/60 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-xl opacity-0 scale-95 transition-all duration-150 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100',
          side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
        )}
      >
        {label}
        <div
          className={clsx(
            'absolute left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-input border-border/60',
            side === 'bottom' ? '-top-1 border-t border-l' : '-bottom-1 border-b border-r'
          )}
        />
      </div>
    </div>
  );
}
