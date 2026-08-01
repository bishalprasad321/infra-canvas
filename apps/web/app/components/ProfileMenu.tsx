'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/useAuthStore';

interface ProfileMenuProps {
  variant?: 'default' | 'compact';
}

export default function ProfileMenu({ variant = 'default' }: ProfileMenuProps) {
  const router = useRouter();
  const { user, hasHydrated, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    router.push('/');
  };

  // Avoid a flash of logged-out UI while the persisted store rehydrates
  if (!hasHydrated) {
    return <div className="h-8 w-8" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={clsx(
          "text-sm font-medium transition-colors",
          variant === 'compact'
            ? "px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary"
            : "px-4 py-2 text-muted-foreground hover:text-foreground"
        )}
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-border bg-card/60 hover:bg-card transition-colors cursor-pointer"
        title={user.name}
      >
        <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase border border-primary/20 flex-shrink-0">
          {user.name.slice(0, 2)}
        </div>
        <Icon icon="lucide:chevron-down" className={clsx("text-xs text-muted-foreground transition-transform hidden sm:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Icon icon="lucide:home" className="text-base text-muted-foreground" />
              Home
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Icon icon="lucide:layout-dashboard" className="text-base text-muted-foreground" />
              Dashboard
            </Link>
            <Link
              href="/workspace"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Icon icon="lucide:layers" className="text-base text-muted-foreground" />
              Workspace
            </Link>
          </div>
          <div className="p-1 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Icon icon="lucide:log-out" className="text-base" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
