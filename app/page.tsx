'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

// --- SUB-COMPONENTS ---

interface HeaderProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ mobileMenuOpen, onToggleMobileMenu }) => {
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
            <a href="#docs" className="text-sm text-muted-foreground transition hover:text-foreground">Docs</a>
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/workspace" className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-md hover:bg-secondary transition">
            Sign In
          </Link>
          <Link href="/workspace" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition">
            Start Free Trial
          </Link>
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
          <a href="#docs" onClick={onToggleMobileMenu} className="text-base text-muted-foreground hover:text-foreground py-2">Docs</a>
          <hr className="border-border my-2" />
          <Link href="/workspace" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg border border-border bg-card py-3 text-sm font-medium text-foreground shadow-md">
            Sign In
          </Link>
          <Link href="/workspace" onClick={onToggleMobileMenu} className="w-full text-center rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg">
            Start Free Trial
          </Link>
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
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-cyan-500/10"></div>
      <div className="absolute left-1/4 top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"></div>
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-12 lg:px-10 lg:py-24">
        <div className="flex flex-col justify-center lg:col-span-6">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground shadow-md">
            <span className="h-2 w-2 rounded-full bg-cyan-500"></span>Trusted by platform teams shipping critical infrastructure
          </div>
          <h1 className="max-w-2xl text-4xl font-heading font-bold leading-tight text-foreground lg:text-6xl">
            Turn complex infrastructure orchestration into a product your teams can trust.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground lg:text-lg">
            Coordinate product, platform, and security workflows from one intelligent command layer. OrchestrateOS unifies automation, observability, governance, and release confidence with enterprise-grade speed.
          </p>
          
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <form onSubmit={onSubmit} className="flex min-h-11 w-full max-w-md items-center rounded-xl border border-border bg-card/90 p-2 shadow-lg">
              <input 
                type="email"
                required
                value={heroEmail}
                onChange={onEmailChange}
                className="h-11 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground" 
                placeholder="Work email" 
                disabled={isLoading || isSubmitted}
              />
              <button 
                type="submit" 
                disabled={isLoading || isSubmitted}
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Icon icon="lucide:loader-2" className="animate-spin" />
                ) : isSubmitted ? (
                  <Icon icon="lucide:check" />
                ) : (
                  "Get Started"
                )}
              </button>
            </form>
            <Link href="/workspace" className="group flex min-h-11 items-center gap-3 rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-medium text-foreground shadow-md hover:bg-secondary/80 transition">
              <span>Book a Demo</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card">
                <Icon icon="lucide:play" className="text-sm text-cyan-500" />
              </span>
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

        <div className="lg:col-span-6">
          <div className="relative mx-auto max-w-2xl rounded-[28px] border border-border bg-card/80 p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[24px] border border-border bg-background/90 p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-secondary/80 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Realtime command center</p>
                  <h2 className="mt-2 text-lg font-heading font-semibold text-foreground">Live orchestration signal</h2>
                </div>
                <div className="rounded-full bg-primary/20 px-3 py-2 text-xs font-medium text-primary">+31% pipeline velocity</div>
              </div>
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-7">
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Deployment health</p>
                        <p className="text-2xl font-heading font-bold text-foreground">99.982%</p>
                      </div>
                      <div className="rounded-full bg-cyan-500/15 px-3 py-2 text-xs font-medium text-cyan-500">Stable</div>
                    </div>
                    <div className="grid grid-cols-12 items-end gap-2 h-40 overflow-hidden">
                      <div className="col-span-1 rounded-t-lg bg-primary/40 h-16 animate-pulse"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/50 h-20"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/60 h-24"></div>
                      <div className="col-span-1 rounded-t-lg bg-cyan-500/70 h-28"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/70 h-24"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/80 h-32"></div>
                      <div className="col-span-1 rounded-t-lg bg-cyan-500/80 h-36"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary h-28"></div>
                      <div className="col-span-1 rounded-t-lg bg-cyan-500 h-40"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/80 h-32"></div>
                      <div className="col-span-1 rounded-t-lg bg-primary/70 h-26"></div>
                      <div className="col-span-1 rounded-t-lg bg-cyan-500/70 h-36"></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Global incident routing</p>
                        <p className="text-xs text-muted-foreground">Auto-resolve critical path blockers</p>
                      </div>
                      <Icon icon="lucide:activity" className="text-xl text-cyan-500" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
                        <span className="text-sm text-muted-foreground">US-East</span>
                        <span className="text-sm font-semibold text-cyan-500">Healthy</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
                        <span className="text-sm text-muted-foreground">Frankfurt</span>
                        <span className="text-sm font-semibold text-foreground">Syncing</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
                        <span className="text-sm text-muted-foreground">Singapore</span>
                        <span className="text-sm font-semibold text-primary">Scaling</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Runtime AI</p>
                        <h3 className="mt-2 text-lg font-heading font-semibold text-foreground">Action recommendations</h3>
                      </div>
                      <div className="rounded-full bg-primary/15 px-3 py-2 text-xs text-primary">Adaptive</div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-border bg-secondary p-3">
                        <p className="text-sm text-foreground">Reduce queue latency by 42ms</p>
                        <p className="mt-1 text-xs text-muted-foreground">Suggested via anomaly pattern detection</p>
                      </div>
                      <div className="rounded-xl border border-border bg-secondary p-3">
                        <p className="text-sm text-foreground">Shift 18% traffic to EU cluster</p>
                        <p className="mt-1 text-xs text-muted-foreground">Maintains SLO under load spike</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Secure change approvals</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">JD</div>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">AM</div>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">SK</div>
                    </div>
                    <div className="mt-4 rounded-xl bg-secondary p-4">
                      <p className="font-mono text-sm text-cyan-500">policy.enforced = true</p>
                      <p className="mt-2 text-xs text-muted-foreground">Every deploy is checked against role, compliance, and blast-radius policy.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
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
    <section id="features" className="border-b border-border">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Interactive platform advantages</p>
          <h2 className="mt-3 text-3xl font-heading font-bold text-foreground lg:text-5xl">A bento grid built for technical buyers who want proof, not promises.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Explore the product through signal-rich interactions that clarify performance, security, and developer experience before the first sales call.</p>
        </div>
        
        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          {/* Performance Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Performance</p>
                <p className="text-xs text-muted-foreground">Tune for lower latency across regions</p>
              </div>
              <div className="rounded-full bg-primary/15 px-3 py-2 text-xs text-primary">Interactive</div>
            </div>
            <div className="mt-8">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current latency reduction</span>
                <span className="font-mono text-foreground">68%</span>
              </div>
              <div className="mt-4 h-3 rounded-full bg-secondary p-1">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-cyan-500"></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">P50</p>
                  <p className="mt-2 text-xl font-heading font-semibold text-foreground">42ms</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">P95</p>
                  <p className="mt-2 text-xl font-heading font-semibold text-foreground">88ms</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Deploy time</p>
                  <p className="mt-2 text-xl font-heading font-semibold text-cyan-500">-31%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Security</p>
                <p className="text-xs text-muted-foreground">Adaptive control plane</p>
              </div>
              <Icon icon="lucide:shield" className="text-xl text-cyan-500" />
            </div>
            <div className="mt-8 rounded-2xl border border-border bg-secondary p-4">
              <div className="flex items-center justify-between">
                <span className={`text-sm transition ${!isEnterpriseSecurityToggle ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>Standard</span>
                <button 
                  onClick={onToggleSecurityMode}
                  className="flex h-7 w-14 items-center rounded-full bg-muted px-1 transition relative"
                  aria-label="Toggle Security Mode"
                >
                  <div className={`h-5 w-5 rounded-full bg-cyan-500 transition-transform duration-200 ${isEnterpriseSecurityToggle ? 'translate-x-7' : 'translate-x-0'}`}></div>
                </button>
                <span className={`text-sm transition ${isEnterpriseSecurityToggle ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>Enterprise</span>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-card px-3 py-3">
                  <span className="text-sm text-muted-foreground">Encryption</span>
                  <span className="text-sm font-medium text-foreground">{isEnterpriseSecurityToggle ? "AES-256 + KMS" : "AES-128"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-card px-3 py-3">
                  <span className="text-sm text-muted-foreground">Runtime policy</span>
                  <span className={`text-sm font-medium ${isEnterpriseSecurityToggle ? 'text-cyan-500' : 'text-foreground'}`}>
                    {isEnterpriseSecurityToggle ? "Always on" : "On-demand"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-card px-3 py-3">
                  <span className="text-sm text-muted-foreground">Audit trail</span>
                  <span className="text-sm font-medium text-foreground">{isEnterpriseSecurityToggle ? "Immutable" : "Standard"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Integrations Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Integrations</p>
                <p className="text-xs text-muted-foreground">Ship clean workflows in any stack</p>
              </div>
              <div className="rounded-full bg-cyan-500/15 px-3 py-2 text-xs text-cyan-500">SDK</div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button 
                onClick={() => onSelectSdkTab('curl')}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${selectedSdkTab === 'curl' ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-muted-foreground'}`}
              >
                curl
              </button>
              <button 
                onClick={() => onSelectSdkTab('python')}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${selectedSdkTab === 'python' ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-muted-foreground'}`}
              >
                Python
              </button>
              <button 
                onClick={() => onSelectSdkTab('node')}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${selectedSdkTab === 'node' ? 'bg-primary text-primary-foreground' : 'border border-border bg-secondary text-muted-foreground'}`}
              >
                Node.js
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-background p-4 min-h-[120px] flex items-center">
              <pre className="overflow-x-auto font-mono text-xs leading-6 text-muted-foreground w-full">
                <code>{getCodeSnippet()}</code>
              </pre>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
              <span className="text-sm text-muted-foreground">Time to first deployment</span>
              <span className="font-mono text-sm text-cyan-500">&lt; 10 min</span>
            </div>
          </div>

          {/* Governance Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Governance without friction</p>
                <h3 className="mt-3 text-2xl font-heading font-semibold text-foreground">Control every release path with visible policy intelligence.</h3>
              </div>
              <div className="rounded-full bg-primary/10 px-4 py-2 text-sm text-primary whitespace-nowrap">Change risk down 57%</div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Approvals</p>
                <p className="mt-4 text-3xl font-heading font-bold text-foreground">4.2x</p>
                <p className="mt-2 text-sm text-muted-foreground">Faster with policy-aware routing</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rollback</p>
                <p className="mt-4 text-3xl font-heading font-bold text-foreground">12 sec</p>
                <p className="mt-2 text-sm text-muted-foreground">Automated safe-state recovery</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visibility</p>
                <p className="mt-4 text-3xl font-heading font-bold text-cyan-500">100%</p>
                <p className="mt-2 text-sm text-muted-foreground">Action-level audit coverage</p>
              </div>
            </div>
          </div>

          {/* Buyer Assurance Card */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl lg:col-span-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Buyer assurance</p>
                <p className="text-xs text-muted-foreground">Built for enterprise evaluation</p>
              </div>
              <Icon icon="lucide:eye" className="text-xl text-primary" />
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <p className="text-sm font-medium text-foreground">Architecture review package</p>
                <p className="mt-2 text-sm text-muted-foreground">Security questionnaires, SSO docs, deployment topology, and sandbox environment included.</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <p className="text-sm font-medium text-foreground">Technical onboarding support</p>
                <p className="mt-2 text-sm text-muted-foreground">White-glove migration and implementation guidance for platform and product teams.</p>
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
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Pricing designed for scale</p>
            <h2 className="mt-3 text-3xl font-heading font-bold text-foreground lg:text-5xl">Choose a plan that grows from fast-moving teams to global enterprise orchestration.</h2>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-3 py-2 shadow-md">
            <span className={`text-sm transition ${!isAnnualBilling ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
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
              <p className="mt-3 text-sm text-muted-foreground">For smaller platform teams proving internal automation ROI.</p>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
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
              </div>
            </div>
            <Link href="/workspace" className="mt-8 w-full text-center rounded-lg border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition">
              Start Free Trial
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
              <p className="mt-3 text-sm text-muted-foreground">For high-growth organizations needing policy, observability, and governance in one layer.</p>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
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
            <Link href="/workspace" className="mt-8 w-full text-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition">
              Talk to Sales
            </Link>
          </div>

          {/* Custom Plan */}
          <div className="rounded-[24px] border border-border bg-card/80 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Custom</p>
              <p className="mt-4 text-5xl font-heading font-bold text-foreground">Let’s talk</p>
              <p className="mt-3 text-sm text-muted-foreground">For regulated, multi-region, or highly customized platform operating models.</p>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
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
              </div>
            </div>
            <Link href="/workspace" className="mt-8 w-full text-center rounded-lg border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition">
              Contact Us
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
              <div className="h-4 w-4 rounded-md bg-gradient-to-br from-primary to-cyan-500"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">OrchestrateOS</p>
              <p className="text-xs text-muted-foreground">Enterprise orchestration platform</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">Give engineering leadership a secure control layer for releases, reliability, and infrastructure operations.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">SOC2</span>
            <span className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">GDPR</span>
            <span className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">ISO-ready</span>
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
            <li><span className="hover:text-foreground transition cursor-pointer">Docs</span></li>
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
          <p className="text-sm font-semibold text-foreground">Stay in the loop</p>
          <p className="mt-4 text-sm text-muted-foreground">Monthly product notes, architecture insights, and launch updates.</p>
          <div className="mt-5 rounded-2xl border border-border bg-card p-3 shadow-md">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <input 
                type="email"
                required
                value={footerEmail}
                onChange={onEmailChange}
                disabled={isLoading || isSubmitted}
                className="h-11 rounded-xl border border-input bg-secondary px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground" 
                placeholder="Enter your email" 
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
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>© 2026 OrchestrateOS. All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            <span className="hover:text-foreground transition cursor-pointer">Privacy</span>
            <span className="hover:text-foreground transition cursor-pointer">Terms</span>
            <span className="hover:text-foreground transition cursor-pointer">DPA</span>
            <span className="hover:text-foreground transition cursor-pointer">Accessibility</span>
          </div>
        </div>
      </div>
    </footer>
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

  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative text-foreground font-sans overflow-x-hidden">
      <Header 
        mobileMenuOpen={mobileMenuOpen} 
        onToggleMobileMenu={toggleMobileMenu} 
      />
      
      <main className="flex flex-1 flex-col">
        <HeroSection 
          heroEmail={heroEmail}
          onEmailChange={handleHeroEmailChange}
          onSubmit={handleHeroSubmit}
          isLoading={heroLoading}
          isSubmitted={heroSubmitted}
        />

        <LogoCloud />

        <BentoGrid 
          selectedSdkTab={selectedSdkTab}
          onSelectSdkTab={selectSdkTab}
          isEnterpriseSecurityToggle={isEnterpriseSecurityToggle}
          onToggleSecurityMode={toggleSecurityMode}
        />

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