'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../store/useAuthStore';
import ProfileMenu from '../components/ProfileMenu';

export default function DocsPage() {
  const { user, hasHydrated } = useAuthStore();
  const isLoggedIn = hasHydrated && !!user;

  const [activeTab, setActiveTab] = useState<'windows' | 'macos' | 'linux'>('windows');
  const [activeSection, setActiveSection] = useState<string>('intro');

  const API_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:8080';
  const downloadBaseUrl = `${API_URL}/downloads`;

  const downloadLinks = {
    windows: `${downloadBaseUrl}/infracanvas-windows-amd64.exe`,
    macosSilicon: `${downloadBaseUrl}/infracanvas-darwin-arm64`,
    macosIntel: `${downloadBaseUrl}/infracanvas-darwin-amd64`,
    linux: `${downloadBaseUrl}/infracanvas-linux-amd64`,
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-cyan-500/35 selection:text-white">
      {/* BACKGROUND GRADIENTS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"></div>
        <div className="absolute bottom-10 right-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl"></div>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 shadow-md">
                <div className="h-4 w-4 rounded-md bg-gradient-to-br from-primary to-cyan-500"></div>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-white">OrchestrateOS</p>
                <p className="text-xs text-slate-400">Documentation</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition mr-4">
              Back to Home
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition">
                  Dashboard
                </Link>
                <ProfileMenu variant="compact" />
              </>
            ) : (
              <Link href="/login" className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-slate-800 transition">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 px-6 py-8 lg:px-10">
        {/* SIDEBAR NAVIGATION */}
        <aside className="hidden w-64 shrink-0 lg:block border-r border-slate-800/80 pr-8">
          <nav className="sticky top-28 flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Getting Started</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <button
                    onClick={() => setActiveSection('intro')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'intro' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:book-open" className="text-base" />
                    Introduction
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('install')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'install' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:download" className="text-base" />
                    Installation Guide
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">CLI Commands</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <button
                    onClick={() => setActiveSection('auth')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'auth' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:key-round" className="text-base" />
                    Authentication
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('projects')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'projects' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:folder-git-2" className="text-base" />
                    Projects CRUD
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('import')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'import' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:upload-cloud" className="text-base" />
                    Importing Code
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('deploy')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeSection === 'deploy' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}
                  >
                    <Icon icon="lucide:play-circle" className="text-base" />
                    Deploy & Runs
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* DOCS CONTENT */}
        <main className="flex-1 lg:pl-10 max-w-3xl">
          {/* SECTION 1: INTRO */}
          {activeSection === 'intro' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">OrchestrateOS CLI</h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                The OrchestrateOS Command-Line Interface (`infracanvas`) is a powerful tool designed to integrate visual configuration layouts directly with native infrastructure-as-code manifests. With the CLI, platform teams can synchronize local directories, query workspace settings, and stream deployment pipelines from their local terminals or CI/CD pipelines.
              </p>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
                <h3 className="text-base font-semibold text-white">Main Capabilities</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-400">
                  <li className="flex items-start gap-3">
                    <Icon icon="lucide:check-circle-2" className="text-cyan-500 mt-0.5 shrink-0 text-base" />
                    <span><strong>Code Reverse-Parsing</strong>: Recursively parse Terraform HCL, Ansible YAML, and Kubernetes manifests into canvas visual blocks.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon icon="lucide:check-circle-2" className="text-cyan-500 mt-0.5 shrink-0 text-base" />
                    <span><strong>Live WebSocket Sync</strong>: Sync changes locally and see the browser visual canvas update in real-time.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Icon icon="lucide:check-circle-2" className="text-cyan-500 mt-0.5 shrink-0 text-base" />
                    <span><strong>Deployment Logs Stream</strong>: Pipe pipeline output straight to terminal stdout.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setActiveSection('install')}
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 transition flex items-center gap-2"
                >
                  Proceed to Installation
                  <Icon icon="lucide:arrow-right" />
                </button>
              </div>
            </section>
          )}

          {/* SECTION 2: INSTALL */}
          {activeSection === 'install' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Installation Guide</h1>
              <p className="text-slate-400">
                Choose your platform below to download and configure the standalone `infracanvas` CLI tool.
              </p>

              {/* DOWNLOAD GATE */}
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Icon icon="lucide:download-cloud" className="text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Download Executables</h3>
                    <p className="text-xs text-slate-400">Always compiled with the latest stable CLI changes.</p>
                  </div>
                </div>

                {isLoggedIn ? (
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <a
                      href={downloadLinks.windows}
                      download
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Icon icon="logos:microsoft-windows" className="text-base" />
                        Windows 64-bit
                      </span>
                      <Icon icon="lucide:arrow-down-to-line" className="text-slate-500" />
                    </a>
                    <a
                      href={downloadLinks.macosSilicon}
                      download
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Icon icon="logos:apple" className="text-base text-white" />
                        macOS (Apple M1/M2/M3)
                      </span>
                      <Icon icon="lucide:arrow-down-to-line" className="text-slate-500" />
                    </a>
                    <a
                      href={downloadLinks.macosIntel}
                      download
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Icon icon="logos:apple" className="text-base" />
                        macOS (Intel Core)
                      </span>
                      <Icon icon="lucide:arrow-down-to-line" className="text-slate-500" />
                    </a>
                    <a
                      href={downloadLinks.linux}
                      download
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Icon icon="logos:linux-tux" className="text-base" />
                        Linux 64-bit
                      </span>
                      <Icon icon="lucide:arrow-down-to-line" className="text-slate-500" />
                    </a>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950 p-6 text-center">
                    <Icon icon="lucide:lock" className="text-slate-600 text-3xl mb-2" />
                    <p className="text-sm text-slate-400 mb-4">You must be logged in to download compiled binaries.</p>
                    <Link
                      href="/login"
                      className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 text-xs font-semibold text-slate-950 transition"
                    >
                      Sign In to Download
                    </Link>
                  </div>
                )}
              </div>

              {/* INSTALL TABS */}
              <div className="mt-8">
                <div className="flex border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab('windows')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'windows' ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                  >
                    Windows
                  </button>
                  <button
                    onClick={() => setActiveTab('macos')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'macos' ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                  >
                    macOS
                  </button>
                  <button
                    onClick={() => setActiveTab('linux')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === 'linux' ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                  >
                    Linux
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {activeTab === 'windows' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        1. Download `infracanvas-windows-amd64.exe` using the link above.
                      </p>
                      <p className="text-sm text-slate-400">
                        2. Create a folder (e.g. `C:\tools\infracanvas`) and move the downloaded binary into it, renaming it to `infracanvas.exe`.
                      </p>
                      <p className="text-sm text-slate-400">
                        3. Add `C:\tools\infracanvas` to your User **Environment Variables PATH**:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                        [System.Environment]::SetEnvironmentVariable("PATH", $env:Path + ";C:\tools\infracanvas", "User")
                      </pre>
                      <p className="text-sm text-slate-400">
                        4. Restart your terminal and verify the installation:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-slate-300">
                        infracanvas --help
                      </pre>
                    </div>
                  )}

                  {activeTab === 'macos' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        1. Download the macOS binary matching your system architecture (Apple Silicon M1/M2/M3 vs Intel Core).
                      </p>
                      <p className="text-sm text-slate-400">
                        2. Move the binary into your local executable search PATH:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                        sudo mv ~/Downloads/infracanvas-darwin-arm64 /usr/local/bin/infracanvas
                      </pre>
                      <p className="text-sm text-slate-400">
                        3. Give the binary execute permissions:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                        chmod +x /usr/local/bin/infracanvas
                      </pre>
                      <p className="text-sm text-slate-400">
                        4. Run command check to verify:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-slate-300">
                        infracanvas --help
                      </pre>
                    </div>
                  )}

                  {activeTab === 'linux' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        1. Download `infracanvas-linux-amd64`.
                      </p>
                      <p className="text-sm text-slate-400">
                        2. Move the binary into `/usr/local/bin`:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                        sudo mv ~/Downloads/infracanvas-linux-amd64 /usr/local/bin/infracanvas
                      </pre>
                      <p className="text-sm text-slate-400">
                        3. Grant execution rights:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                        chmod +x /usr/local/bin/infracanvas
                      </pre>
                      <p className="text-sm text-slate-400">
                        4. Verify installation:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-slate-300">
                        infracanvas --help
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: AUTH */}
          {activeSection === 'auth' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Authentication</h1>
              <p className="text-slate-400">
                To link commands to your user accounts and target workspace permission boundaries, authenticate your CLI instance.
              </p>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Login</h3>
                <p className="text-sm text-slate-400">
                  Run the login sub-command. The program will prompt for your account email and password securely, then query and write your session token:
                </p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas login
                </pre>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-white">Logout</h3>
                <p className="text-sm text-slate-400">
                  To clear your locally cached credentials and end the session:
                </p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas logout
                </pre>
              </div>
            </section>
          )}

          {/* SECTION 4: PROJECTS */}
          {activeSection === 'projects' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Workspace Projects CRUD</h1>
              <p className="text-slate-400">
                Query, initialize, or delete visual workspace canvas projects using the `projects` subcommand.
              </p>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">List Projects</h3>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas projects list
                </pre>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-white">Create a Project</h3>
                <p className="text-sm text-slate-400">Initialize a new project workspace by name:</p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas projects create --name "My VPC Stack" --visibility PRIVATE
                </pre>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-white">Delete a Project</h3>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas projects delete --id "my-vpc-stack-id" --force
                </pre>
              </div>
            </section>
          )}

          {/* SECTION 5: IMPORT */}
          {activeSection === 'import' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Importing IaC Code</h1>
              <p className="text-slate-400">
                You can import existing code configurations directly into your visual workspace. The engine automatically maps resource structures into nodes/edges and auto-arranges layout coordinates.
              </p>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Import a Single File</h3>
                <p className="text-sm text-slate-400">Upload and parse a single Terraform or Kubernetes configuration:</p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas import --project "VPC-Stack" --file "./terraform/main.tf"
                </pre>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-white">Import a Directory</h3>
                <p className="text-sm text-slate-400">Recursively scan and import all configurations from a target directory:</p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas import --project "VPC-Stack" --dir "./deployments/"
                </pre>
              </div>
            </section>
          )}

          {/* SECTION 6: DEPLOY */}
          {activeSection === 'deploy' && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">Deploy & Logs Streaming</h1>
              <p className="text-slate-400">
                Deploy pipelines from the visual canvas and stream execution logs directly to your shell.
              </p>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Execute Deployment Pipeline</h3>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas deploy --project "VPC-Stack"
                </pre>
                <p className="text-sm text-slate-400 mt-2">
                  This command connects to the deployment tracker socket, streaming all progress logs sequentially and printing them in real-time.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-white">Deploy with Auto-Destroy</h3>
                <p className="text-sm text-slate-400">To spin up testing systems and tear them down immediately upon execution completion:</p>
                <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono overflow-x-auto text-cyan-400">
                  infracanvas deploy --project "VPC-Stack" --auto-destroy
                </pre>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-8 relative z-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>© 2026 OrchestrateOS. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-slate-300 transition">Home</Link>
            <span className="cursor-not-allowed">Terms</span>
            <span className="cursor-not-allowed">Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
