'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Icon } from '@iconify/react';

// Dynamic import with ssr: false because Three.js WebGPU / Canvas needs browser APIs
const HeroFuturistic = dynamic(
  () => import('@/components/ui/hero-futuristic'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-black text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="text-xs uppercase tracking-widest font-mono text-cyan-400">Initializing WebGPU Scene...</p>
        </div>
      </div>
    ),
  }
);

export default function DemoPage() {
  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Floating navigation overlay */}
      <div className="fixed top-6 left-6 z-70">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        >
          <Icon icon="lucide:arrow-left" className="text-sm" />
          Back to Landing Page
        </Link>
      </div>

      {/* Futuristic Hero Component */}
      <HeroFuturistic />
    </div>
  );
}
