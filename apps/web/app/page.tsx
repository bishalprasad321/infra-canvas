'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useAuthStore } from './store/useAuthStore';
import ProfileMenu from './components/ProfileMenu';

// --- SUB-COMPONENTS ---

interface HeaderProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ mobileMenuOpen, onToggleMobileMenu }) => {
  const { user, hasHydrated } = useAuthStore();
  const isLoggedIn = hasHydrated && !!user;

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-md">
              <div className="h-4 w-4 rounded-md bg-gradient-to-br from-primary to-cyan-500"></div>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">OrchestrateOS</p>
              <p className="text-xs text-muted-foreground">Runtime intelligence for modern teams</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 lg:flex ml-8">
            <a href="#features" className="text-sm text-muted-foreground transition hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition hover:text-foreground">Pricing</a>
            <Link href="/docs" className="text-sm text-muted-foreground transition hover:text-foreground">Docs</Link>
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition">
                Go to Dashboard
              </Link>
              <ProfileMenu variant="compact" />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-md hover:bg-secondary transition">
                Sign In
              </Link>
              <Link href="/login?mode=signup" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition">
                Start Free Trial
              </Link>
            </>
          )}
        </div>

        <button
          onClick={onToggleMobileMenu}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card md:hidden"
          aria-label="Toggle Menu"
        >
          <Icon icon={mobileMenuOpen ? "lucide:x" : "lucide:menu"} className="text-xl text-foreground" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-background border-b border-border p-6 flex flex-col gap-4 md:hidden shadow-2xl animate-in fade-in slide-in-from-top-5 duration-200">
          <a href="#features" onClick={onToggleMobileMenu} className="text-base text-muted-foreground hover:text-foreground py-2">Features</a>
          <a href="#pricing" onClick={onToggleMobileMenu} className="text-base text-muted-foreground hover:text-foreground py-2">Pricing</a>
          <Link href="/docs" onClick={onToggleMobileMenu} className="text-base text-muted-foreground hover:text-foreground py-2">Docs</Link>
          <hr className="border-border my-2" />
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg">
                Go to Dashboard
              </Link>
              <Link href="/workspace" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-md">
                Workspace
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-md">
                Sign In
              </Link>
              <Link href="/login?mode=signup" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg">
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};

interface HeroSectionProps {
  heroEmail: string;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isSubmitted: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ heroEmail, onEmailChange, onSubmit, isLoading, isSubmitted }) => {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-grid-pattern pt-16 pb-20 lg:pt-24 lg:pb-28">
      {/* Designer background mesh glows */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-primary/10 via-cyan-500/5 to-violet-500/10 rounded-full blur-[120px] pointer-events-none animate-mesh-1"></div>
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[250px] bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none animate-mesh-2"></div>

      <div className="relative mx-auto w-full max-w-7xl px-6 lg:px-10 flex flex-col items-center text-center">
        {/* Magic pill badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-300 shadow-lg shadow-cyan-950/20 backdrop-blur-md animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>Introducing Local DevOps Sandbox Runtime Simulation</span>
        </div>

        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl leading-[1.1] font-heading">
          Visual Cloud Architecture.<br />
          <span className="bg-gradient-to-r from-cyan-400 via-primary to-violet-400 bg-clip-text text-transparent">Compiled to Code. Executed Locally.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-sm md:text-base leading-relaxed text-muted-foreground">
          InfraCanvas unifies provisioning (Terraform) and server configuration (Ansible) into a single visual compiler. Drag components, verify logic, and run deployment flows in a zero-cost local sandboxed environment before pushing to AWS.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center justify-center w-full max-w-lg">
          <form onSubmit={onSubmit} className="flex min-h-12 w-full items-center rounded-xl border border-white/[0.08] bg-slate-900/60 p-1.5 shadow-lg backdrop-blur-md">
            <input
              type="email"
              required
              value={heroEmail}
              onChange={onEmailChange}
              className="h-11 flex-1 bg-transparent px-4 text-xs text-white outline-none placeholder:text-muted-foreground"
              placeholder="Enter work email"
              disabled={isLoading || isSubmitted}
            />
            <button
              type="submit"
              disabled={isLoading || isSubmitted}
              className="rounded-lg bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground hover:opacity-90 active:scale-95 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isLoading ? (
                <Icon icon="lucide:loader-2" className="animate-spin" />
              ) : isSubmitted ? (
                <Icon icon="lucide:check" />
              ) : (
                "Start Free Trial"
              )}
            </button>
          </form>
          <Link href="/login" className="group flex min-h-12 items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-slate-900/40 px-6 py-3 text-xs font-semibold text-white shadow-md hover:bg-slate-900/80 transition">
            <span>Book a Demo</span>
            <Icon icon="lucide:arrow-right" className="text-xs text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {isSubmitted && (
          <p className="mt-3 text-sm text-cyan-400 flex items-center gap-2">
            <Icon icon="lucide:check-circle" /> Thank you! We will reach out to you shortly.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:shield" className="text-lg text-cyan-500" />
            <span>SOC2-ready architecture</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:zap" className="text-lg text-cyan-500" />
            <span>Deploy in under 15 minutes</span>
          </div>
        </div>
      </div>

      {/* Dynamic Sandbox Playground */}
      <div className="mt-16 w-full animate-in fade-in duration-1000">
        <InteractiveSandbox />
      </div>
    </div>
    </section >
  );
};

const LogoCloud: React.FC = () => {
  return (
    <section className="border-b border-border py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 lg:px-10">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">Trusted by engineering leaders at</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">Datadrift</div>
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">Cortex Cloud</div>
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">VectorOps</div>
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">Northstar AI</div>
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">Monolith Labs</div>
          <div className="rounded-xl border border-border bg-card/60 px-5 py-4 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-default">ScaleGrid</div>
        </div>
      </div>
    </section>
  );
};

interface BentoGridProps {
  selectedSdkTab: string;
  onSelectSdkTab: (tab: string) => void;
  isEnterpriseSecurityToggle: boolean;
  onToggleSecurityMode: () => void;
}

const BentoGrid: React.FC<BentoGridProps> = ({ selectedSdkTab, onSelectSdkTab, isEnterpriseSecurityToggle, onToggleSecurityMode }) => {
  const getCodeSnippet = () => {
    switch (selectedSdkTab) {
      case 'python':
        return `import orchestrate\n\norchestrate.deploy(\n  service="checkout",\n  policy="strict"\n)`;
      case 'node':
        return `const sdk = require('orchestrate');\n\nsdk.deploy({\n  service: "checkout",\n  policy: "strict"\n});`;
      case 'curl':
      default:
        return `curl -X POST /deploy \\\n  -H 'Authorization: Bearer sk_live' \\\n  -d '{"service":"checkout","policy":"strict"}'`;
    }
  };

  return (
    <section id="features" className="border-b border-white/[0.06] bg-[#030712] py-20 lg:py-28 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-primary font-bold">Architecture Capabilities</p>
          <h2 className="mt-3 text-3xl font-extrabold text-white lg:text-5xl tracking-tight font-heading leading-tight">
            Proof, Not Promises.<br />
            An Interactive Platform Overview.
          </h2>
          <p className="mt-4 text-sm md:text-base leading-relaxed text-muted-foreground">
            Explore the developer experience, compliance guardrails, and runtime performance of InfraCanvas before typing a single terminal command.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          {/* Performance latency card */}
          <div className="rounded-3xl border border-white/[0.06] bg-slate-900/20 p-6 shadow-xl lg:col-span-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors"></div>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Tuning Latency Optimizer</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Drag to adjust target cache ratios</p>
                </div>
                <div className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-[10px] font-bold text-cyan-400 font-mono">Interactive</div>
              </div>

              <div className="mt-8 border border-white/[0.04] bg-slate-950/60 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Local Cache Allocation</span>
                  <span className="font-mono text-cyan-400 font-bold">{tuningVal}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={tuningVal}
                  onChange={(e) => setTuningVal(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer mt-4"
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/[0.04] bg-slate-950/40 p-4 text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">P50 Latency</p>
                <p className="mt-2 text-lg font-bold text-white font-mono">{Math.round(98 - tuningVal * 0.8)}ms</p>
              </div>
              <div className="rounded-2xl border border-white/[0.04] bg-slate-950/40 p-4 text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">P95 Latency</p>
                <p className="mt-2 text-lg font-bold text-white font-mono">{Math.round(180 - tuningVal * 1.3)}ms</p>
              </div>
              <div className="rounded-2xl border border-white/[0.04] bg-slate-950/40 p-4 text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Deploy Cost</p>
                <p className="mt-2 text-lg font-bold text-emerald-400 font-mono">-$0.00</p>
              </div>
            </div>
          </div>

          {/* Security control compliance card */}
          <div className="rounded-3xl border border-white/[0.06] bg-slate-900/20 p-6 shadow-xl lg:col-span-3 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors"></div>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Security Level</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Compliance posture switch</p>
                </div>
                <Icon icon="lucide:shield" className="text-lg text-violet-400" />
              </div>

              <div className="mt-6 border border-white/[0.04] bg-slate-950/60 p-4 rounded-2xl">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={`transition ${!isEnterpriseSecurityToggle ? 'text-white' : 'text-slate-500'}`}>Standard</span>
                  <button
                    onClick={onToggleSecurityMode}
                    className="flex h-6 w-12 items-center rounded-full bg-slate-800 p-0.5 transition cursor-pointer"
                    aria-label="Toggle Security Mode"
                  >
                    <div className={`h-5 w-5 rounded-full bg-cyan-400 shadow-md transition-transform duration-200 ${isEnterpriseSecurityToggle ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                  <span className={`transition ${isEnterpriseSecurityToggle ? 'text-white' : 'text-slate-500'}`}>Enterprise</span>
                </div>

                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/80 p-2.5 border border-white/[0.02]">
                    <span className="text-[9px] text-slate-400">Encryption</span>
                    <span className="text-[9px] font-bold text-white font-mono">{isEnterpriseSecurityToggle ? "AES-256 + KMS" : "AES-128"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/80 p-2.5 border border-white/[0.02]">
                    <span className="text-[9px] text-slate-400">Auditing</span>
                    <span className={`text-[9px] font-bold font-mono ${isEnterpriseSecurityToggle ? 'text-emerald-400' : 'text-white'}`}>
                      {isEnterpriseSecurityToggle ? "Opa Policy Lock" : "Post-Deploy"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[9px] text-muted-foreground leading-relaxed mt-4 italic">
              {isEnterpriseSecurityToggle
                ? "*Strict policy enforcement active. Deployment paths are locked by OPA constraints."
                : "*Standard prototyping mode. Audits are calculated on-demand."}
            </p>
          </div>

          {/* Integrations API card */}
          <div className="rounded-3xl border border-white/[0.06] bg-slate-900/20 p-6 shadow-xl lg:col-span-4 flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Integrations API</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Control environments via code</p>
                </div>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-[9px] font-bold text-cyan-400 font-mono">SDK</span>
              </div>

              <div className="mt-4 flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-white/[0.03] w-fit">
                {['curl', 'python', 'node'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => onSelectSdkTab(tab)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer ${selectedSdkTab === tab
                      ? 'bg-primary text-white shadow-md'
                      : 'text-muted-foreground hover:text-white'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.04] bg-slate-950/80 p-4 min-h-[140px] flex items-center overflow-x-auto">
                <pre className="font-mono text-[9px] md:text-[10px] leading-relaxed text-slate-300 w-full">
                  <code>{getCodeSnippet()}</code>
                </pre>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/40 border border-white/[0.03] px-3.5 py-2.5">
              <span className="text-[10px] text-muted-foreground">Sandbox Compilation Time</span>
              <span className="font-mono text-[10px] text-cyan-400 font-bold">&lt; 2.5s</span>
            </div>
          </div>

          {/* Governance Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Governance without friction</p>
                <h3 className="mt-3 text-2xl font-heading font-semibold text-foreground">Control every release path with visible policy intelligence.</h3>
              </div>
              <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-center shrink-0">
                <p className="text-xs font-semibold text-primary">Deployment Failures</p>
                <p className="text-xl font-bold text-white mt-1">-57%</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.04] bg-slate-950/40 p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Change Audits</p>
                <p className="mt-3 text-2xl font-extrabold text-white font-mono">Instant</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Compliance check on link drops</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visibility</p>
                <p className="mt-4 text-3xl font-heading font-bold text-cyan-500">100%</p>
                <p className="mt-2 text-sm text-muted-foreground">Action-level audit coverage</p>
              </div>
            </div>
          </div>

          {/* DevOps Synergy Buyer Assurance Card */}
          <div className="rounded-3xl border border-white/[0.06] bg-slate-900/20 p-6 shadow-xl lg:col-span-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Ansible &amp; Terraform Synergy</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Automatic Inventory Binding</p>
                </div>
                <Icon icon="lucide:zap" className="text-lg text-emerald-400" />
              </div>

              <div className="mt-6 space-y-3.5">
                <div className="rounded-2xl border border-white/[0.04] bg-slate-950/60 p-4.5">
                  <h5 className="text-xs font-bold text-white">Dynamic Outputs Mapping</h5>
                  <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                    Instead of copying host IPs from EC2 attributes to hosts files, InfraCanvas extracts outputs from compiled HCL resources and binds them as host targets inside configuration scripts automatically.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.04] bg-slate-950/60 p-4.5">
                  <h5 className="text-xs font-bold text-white">Target Container Sandboxing</h5>
                  <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                    Verify playbooks locally. The simulation boots Ubuntu SSH containers, logs playbooks line-by-line, and traces failures inside isolated Docker boundaries.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

interface PricingSectionProps {
  isAnnualBilling: boolean;
  onToggleBillingCycle: () => void;
}

const PricingSection: React.FC<PricingSectionProps> = ({ isAnnualBilling, onToggleBillingCycle }) => {
  const calculatePrice = (basePrice: number) => {
    if (isAnnualBilling) {
      return Math.round(basePrice * 0.8); // 20% discount
    }
    return basePrice;
  };

  return (
    <section id="pricing" className="border-b border-white/[0.06] bg-[#030712] py-20 lg:py-28 relative">
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Pricing designed for scale</p>
            <h2 className="mt-3 text-3xl font-heading font-bold text-foreground lg:text-5xl">Choose a plan that grows from fast-moving teams to global enterprise orchestration.</h2>
          </div>

          <div className="flex items-center gap-3.5 rounded-full border border-white/[0.08] bg-slate-900/60 px-4 py-2.5 shadow-lg backdrop-blur-md shrink-0">
            <span className={`text-xs font-semibold transition ${!isAnnualBilling ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
            <button
              onClick={onToggleBillingCycle}
              className="flex h-8 w-16 items-center rounded-full bg-primary px-1 transition"
              aria-label="Toggle Billing Cycle"
            >
              <div className={`h-6 w-6 rounded-full bg-primary-foreground transition-transform duration-200 ${isAnnualBilling ? 'translate-x-8' : 'translate-x-0'}`}></div>
            </button>
            <span className={`text-sm transition ${isAnnualBilling ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>Annual</span>
            <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-500">Save 20%</span>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Starter Plan */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Starter</p>
              <p className="mt-4 text-5xl font-heading font-bold text-foreground">
                ${calculatePrice(49)}
                <span className="text-base font-normal text-muted-foreground">/seat</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                For developers testing local infrastructure configs and configurations visually.
              </p>

              <hr className="border-white/[0.04] my-6" />

              <div className="space-y-4 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>5 workflow environments</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Core deployment automations</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Email support</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-sm text-cyan-400" />
                  <span>Export Code Bundles (ZIP download)</span>
                </div>
              </div>
            </div>

            <Link href="/login?mode=signup" className="mt-8 w-full text-center rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900/80 px-4 py-3.5 text-xs font-semibold text-white transition active:scale-95">
              Get Started Free
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className="rounded-[24px] border border-primary bg-card/90 p-6 shadow-2xl flex flex-col justify-between relative">
            <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Most Popular
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Enterprise</p>
              <p className="mt-4 text-5xl font-heading font-bold text-foreground">
                ${calculatePrice(149)}
                <span className="text-base font-normal text-muted-foreground">/seat</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                For growing DevOps and engineering teams requiring collaborative environment building.
              </p>

              <hr className="border-white/[0.04] my-6" />

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Unlimited orchestration workflows</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>SSO, RBAC, and approval routing</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Advanced audit logs and controls</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Priority implementation support</span>
                </div>
              </div>
            </div>

            <Link href="/login" className="mt-8 w-full text-center rounded-xl bg-primary px-4 py-3.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition active:scale-95 shadow-lg shadow-primary/20">
              Start Free Team Trial
            </Link>
          </div>

          {/* Custom Plan */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Enterprise (Scale)</p>
                <Icon icon="lucide:building-2" className="text-lg text-slate-400" />
              </div>
              <p className="mt-5 text-4xl font-extrabold text-white font-mono tracking-tight">
                ${calculatePrice(149)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                For organizations demanding security enforcement, custom playbooks, and single sign-on.
              </p>

              <hr className="border-white/[0.04] my-6" />

              <div className="space-y-4 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Dedicated security review</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Private deployment options</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-lg text-cyan-500" />
                  <span>Custom SLAs and procurement</span>
                </div>
                <div className="flex items-center gap-3">
                  <Icon icon="lucide:circle-check" className="text-sm text-cyan-400" />
                  <span>Immutable Audit Trails &amp; Dedicated Sandbox Support</span>
                </div>
              </div>
            </div>

            <Link href="/login" className="mt-8 w-full text-center rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900/80 px-4 py-3.5 text-xs font-semibold text-white transition active:scale-95">
              Contact Enterprise Sales
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

interface FooterProps {
  footerEmail: string;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isSubmitted: boolean;
}

const Footer: React.FC<FooterProps> = ({ footerEmail, onEmailChange, onSubmit, isLoading, isSubmitted }) => {
  return (
    <footer className="bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-3">
          <Logo />
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            The collaborative visual compiler and local sandbox environment built for modern platform engineering and DevOps teams.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="rounded-lg border border-white/[0.04] bg-slate-900/40 px-3 py-1.5 text-[9px] font-semibold text-slate-400 font-mono">SOC2 COMPLIANT</span>
            <span className="rounded-lg border border-white/[0.04] bg-slate-900/40 px-3 py-1.5 text-[9px] font-semibold text-slate-400 font-mono">GDPR AUDITED</span>
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="text-sm font-semibold text-foreground">Product</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground transition">Features</a></li>
            <li><a href="#pricing" className="hover:text-foreground transition">Pricing</a></li>
            <li><a href="#features" className="hover:text-foreground transition">Integrations</a></li>
            <li><span className="text-muted-foreground/50 cursor-not-allowed">Roadmap</span></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <p className="text-sm font-semibold text-foreground">Resources</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><Link href="/docs" className="hover:text-white transition">Docs</Link></li>
            <li><span className="hover:text-foreground transition cursor-pointer">API Reference</span></li>
            <li><span className="hover:text-foreground transition cursor-pointer">Case Studies</span></li>
            <li><span className="hover:text-foreground transition cursor-pointer">Status</span></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <p className="text-sm font-semibold text-foreground">Company</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><span className="hover:text-foreground transition cursor-pointer">About</span></li>
            <li><span className="hover:text-foreground transition cursor-pointer">Careers</span></li>
            <li><span className="hover:text-foreground transition cursor-pointer">Security</span></li>
            <li><span className="hover:text-foreground transition cursor-pointer">Contact</span></li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <p className="text-xs uppercase tracking-widest text-white font-bold">Stay in the Loop</p>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Monthly product notes, IaC updates, and sandbox simulator features.
          </p>

          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-900/20 p-2 shadow-md">
            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              <input
                type="email"
                required
                value={footerEmail}
                onChange={onEmailChange}
                disabled={isLoading || isSubmitted}
                className="h-10 rounded-xl border border-white/[0.06] bg-slate-950 px-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
                placeholder="Enter email address"
              />
              <button
                type="submit"
                disabled={isLoading || isSubmitted}
                className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Icon icon="lucide:loader-2" className="animate-spin" />
                ) : isSubmitted ? (
                  <Icon icon="lucide:check" />
                ) : (
                  "Subscribe"
                )}
              </button>
              {isSubmitted ? (
                <p className="text-xs text-cyan-500">Successfully subscribed!</p>
              ) : (
                <p className="text-xs text-cyan-500">Looks good — we’ll only send technical updates.</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#02050f]/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 text-[10px] text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>© 2026 InfraCanvas Inc. All rights reserved.</p>
          <div className="flex flex-wrap gap-5 font-mono text-[9px]">
            <span className="hover:text-white transition cursor-pointer">PRIVACY POLICY</span>
            <span className="hover:text-white transition cursor-pointer">TERMS OF SERVICE</span>
            <span className="hover:text-white transition cursor-pointer">DPA AGREEMENT</span>
            <span className="hover:text-white transition cursor-pointer">SECURITY DISCLOSURE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// --- CLI DOWNLOAD SECTION ---

interface CliDownloadSectionProps {
  isLoggedIn: boolean;
}

const CliDownloadSection: React.FC<CliDownloadSectionProps> = ({ isLoggedIn }) => {
  const API_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:8080';
  const downloadBaseUrl = `${API_URL}/downloads`;

  return (
    <section className="relative overflow-hidden border-b border-border py-16 lg:py-24">
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-primary/5"></div>
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-12 lg:px-10">
        <div className="flex flex-col justify-center lg:col-span-7">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/85 px-4 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
            NEW: Standalone CLI Tool v1.0.0
          </div>
          <h2 className="text-3xl font-heading font-bold text-foreground lg:text-4xl">
            Control your cloud from the terminal.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground lg:text-lg">
            Manage visual workspace stacks, trigger remote pipeline executions, stream logs in real-time, and reverse-parse infrastructure manifests directly from your local system.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            {isLoggedIn ? (
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${downloadBaseUrl}/infracanvas-windows-amd64.exe`}
                  download
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium hover:bg-secondary transition flex items-center gap-2.5 shadow-md text-foreground"
                >
                  <Icon icon="logos:microsoft-windows" />
                  Windows
                </a>
                <a
                  href={`${downloadBaseUrl}/infracanvas-darwin-arm64`}
                  download
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium hover:bg-secondary transition flex items-center gap-2.5 shadow-md text-foreground"
                >
                  <Icon icon="logos:apple" className="text-white" />
                  macOS (M-Series)
                </a>
                <a
                  href={`${downloadBaseUrl}/infracanvas-darwin-amd64`}
                  download
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium hover:bg-secondary transition flex items-center gap-2.5 shadow-md text-foreground"
                >
                  <Icon icon="logos:apple" />
                  macOS (Intel)
                </a>
                <a
                  href={`${downloadBaseUrl}/infracanvas-linux-amd64`}
                  download
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium hover:bg-secondary transition flex items-center gap-2.5 shadow-md text-foreground"
                >
                  <Icon icon="logos:linux-tux" />
                  Linux
                </a>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg transition flex items-center gap-2"
              >
                <Icon icon="lucide:lock" />
                Sign In to Download CLI
              </Link>
            )}

            <Link
              href="/docs"
              className="rounded-xl border border-border bg-secondary px-6 py-3.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition flex items-center gap-2 shadow-md"
            >
              <Icon icon="lucide:book-open" />
              CLI Documentation
            </Link>
          </div>

          {!isLoggedIn && (
            <p className="mt-3 text-xs text-muted-foreground">
              CLI documentation is available publicly for review. Signing in is only required to download release binaries.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center lg:col-span-5">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-2xl font-mono text-xs text-cyan-400 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
              </div>
              <span className="text-slate-500">infracanvas --version</span>
            </div>
            <div className="space-y-2 text-slate-300">
              <p><span className="text-slate-500">$</span> infracanvas login</p>
              <p className="text-cyan-400">Enter Email: user@company.com</p>
              <p className="text-slate-500">Successfully authenticated and logged in!</p>
              <p className="mt-2"><span className="text-slate-500">$</span> infracanvas import --project "Dev-Cluster" -f main.tf</p>
              <p className="text-emerald-500">✓ Success: Files imported successfully. Coordinates mapped.</p>
              <p className="text-slate-500">Syncing live visual canvas workspace...</p>
              <p className="mt-2"><span className="text-slate-500">$</span> infracanvas deploy --project "Dev-Cluster"</p>
              <p className="text-cyan-500">[SYSTEM] Pipeline status changed to: RUNNING</p>
              <p className="text-slate-400">aws_instance.web: Creating...</p>
              <p className="text-emerald-500">[SYSTEM] Pipeline status changed to: SUCCESS</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- MAIN COMPONENT ---

export default function MarketingLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [heroEmail, setHeroEmail] = useState<string>("");
  const [heroLoading, setHeroLoading] = useState<boolean>(false);
  const [heroSubmitted, setHeroSubmitted] = useState<boolean>(false);

  const [selectedSdkTab, setSelectedSdkTab] = useState<string>("curl");
  const [isEnterpriseSecurityToggle, setIsEnterpriseSecurityToggle] = useState<boolean>(true);
  const [isAnnualBilling, setIsAnnualBilling] = useState<boolean>(true);

  const [footerEmail, setFooterEmail] = useState<string>("");
  const [footerLoading, setFooterLoading] = useState<boolean>(false);
  const [footerSubmitted, setFooterSubmitted] = useState<boolean>(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleHeroEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeroEmail(e.target.value);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroEmail) return;
    setHeroLoading(true);
    setTimeout(() => {
      setHeroLoading(false);
      setHeroSubmitted(true);
    }, 1200);
  };

  const selectSdkTab = (tab: string) => {
    setSelectedSdkTab(tab);
  };

  const toggleSecurityMode = () => {
    setIsEnterpriseSecurityToggle(!isEnterpriseSecurityToggle);
  };

  const toggleBillingCycle = () => {
    setIsAnnualBilling(!isAnnualBilling);
  };

  const handleFooterEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFooterEmail(e.target.value);
  };

  const handleFooterSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!footerEmail) return;
    setFooterLoading(true);
    setTimeout(() => {
      setFooterLoading(false);
      setFooterSubmitted(true);
    }, 1200);
  };

  const { user, hasHydrated } = useAuthStore();
  const isLoggedIn = hasHydrated && !!user;

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col relative text-slate-100 font-sans overflow-x-hidden">

      {/* Dynamic background dot mesh */}
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none z-0 opacity-40"></div>

      <Header
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={toggleMobileMenu}
      />

      <main className="flex flex-1 flex-col relative z-10">
        <HeroSection
          heroEmail={heroEmail}
          onEmailChange={handleHeroEmailChange}
          onSubmit={handleHeroSubmit}
          isLoading={heroLoading}
          isSubmitted={heroSubmitted}
        />

        <LogoCloud />

        {/* Highlight Section: Niches Solutions */}
        <section id="solutions" className="border-b border-white/[0.06] bg-[#030712]/70 py-20 lg:py-24 relative">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="text-xs uppercase tracking-widest text-primary font-bold">Niche Solutions</p>
              <h2 className="mt-3 text-3xl font-extrabold text-white lg:text-4xl tracking-tight font-heading">
                Engineered for Three Crucial DevOps Workflows.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Niche A */}
              <div className="rounded-3xl border border-white/[0.06] bg-slate-900/10 p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-500/20 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-6">
                    <Icon icon="lucide:play" className="text-lg" />
                  </div>
                  <h4 className="text-lg font-bold text-white">The Zero-Cost Playground</h4>
                  <p className="text-xs text-muted-foreground uppercase font-semibold font-mono tracking-wider mt-1.5 text-cyan-400">Startups &amp; Prototyping</p>
                  <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                    Design, run, and destroy complex AWS infrastructures locally without spending a dollar. Simulate VPCs, EC2s, RDS databases, and Ubuntu servers inside Docker with zero latency.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] text-cyan-400 font-semibold">
                  <span>Eliminate cloud sprawl</span>
                  <Icon icon="lucide:chevron-right" className="text-xs" />
                </div>
              </div>

              {/* Niche B */}
              <div className="rounded-3xl border border-white/[0.06] bg-slate-900/10 p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/20 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl"></div>
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6">
                    <Icon icon="lucide:users" className="text-lg" />
                  </div>
                  <h4 className="text-lg font-bold text-white">Collaborative Platform-as-a-Product</h4>
                  <p className="text-xs text-muted-foreground uppercase font-semibold font-mono tracking-wider mt-1.5 text-violet-400">Mid-Market Platform Teams</p>
                  <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                    Figma for Cloud Infrastructure. Platform engineers define secure base components while developers use the canvas to self-serve approved cloud architecture blueprints dynamically.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] text-violet-400 font-semibold">
                  <span>Eliminate DevOps ticket queues</span>
                  <Icon icon="lucide:chevron-right" className="text-xs" />
                </div>
              </div>

              {/* Niche C */}
              <div className="rounded-3xl border border-white/[0.06] bg-slate-900/10 p-6 md:p-8 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/20 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6">
                    <Icon icon="lucide:shield-check" className="text-lg" />
                  </div>
                  <h4 className="text-lg font-bold text-white">DevSecOps Auditing &amp; Governance</h4>
                  <p className="text-xs text-muted-foreground uppercase font-semibold font-mono tracking-wider mt-1.5 text-emerald-400">Enterprise Leadership</p>
                  <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                    Visual architecture map makes security reviews immediate. Canvas locks, JWT authentication control, and OPA Sentinel policies verify every deployment configuration path.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                  <span>Lower cloud misconfiguration risk</span>
                  <Icon icon="lucide:chevron-right" className="text-xs" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <BentoGrid
          selectedSdkTab={selectedSdkTab}
          onSelectSdkTab={selectSdkTab}
          isEnterpriseSecurityToggle={isEnterpriseSecurityToggle}
          onToggleSecurityMode={toggleSecurityMode}
        />

        <CliDownloadSection isLoggedIn={isLoggedIn} />

        <PricingSection
          isAnnualBilling={isAnnualBilling}
          onToggleBillingCycle={toggleBillingCycle}
        />

        <Footer
          footerEmail={footerEmail}
          onEmailChange={handleFooterEmailChange}
          onSubmit={handleFooterSubscribe}
          isLoading={footerLoading}
          isSubmitted={footerSubmitted}
        />
      </main>
    </div>
  );
}