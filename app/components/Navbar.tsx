'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

export default function Navbar() {
  const pathname = usePathname();

  const getLinkClass = (href: string) => {
    const isActive = pathname === href;
    return clsx(
      "px-4 py-2 text-sm font-medium transition-all duration-150 border-b-2",
      isActive
        ? "text-primary border-primary font-semibold"
        : "text-muted-foreground hover:text-foreground border-transparent hover:border-muted-foreground/30"
    );
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border select-none shrink-0">
      <div className="flex items-center gap-1 px-4 h-12">
        <Link href="/" className={getLinkClass('/')}>
          Home
        </Link>
        <Link href="/workspace" className={getLinkClass('/workspace')}>
          Workspace
        </Link>
        <Link href="/export-code" className={getLinkClass('/export-code')}>
          Export Code
        </Link>
      </div>
    </nav>
  );
}
