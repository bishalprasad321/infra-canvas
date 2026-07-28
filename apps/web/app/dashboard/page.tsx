'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../store/useAuthStore';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'deploying' | 'success' | 'idle' | 'failed';
  lastUpdated: string;
  collaborators: { name: string; initials: string; color: string }[];
  tags: string[];
}

const PROJECTS: Project[] = [
  {
    id: 'Web-Server-Orchestration',
    name: 'Web Server Orchestration',
    description: 'Automated provisioning of AWS VPC, Subnets, Security Groups, and a multi-tier EC2 instance configured with an Ansible Nginx playbook.',
    status: 'success',
    lastUpdated: '2 hours ago',
    tags: ['Terraform', 'Ansible', 'AWS'],
    collaborators: [
      { name: 'John Doe', initials: 'JD', color: 'bg-rose-500' },
      { name: 'Alice Smith', initials: 'AS', color: 'bg-blue-500' },
      { name: 'Bob Johnson', initials: 'BJ', color: 'bg-violet-500' },
    ],
  },
  {
    id: 'Dev-Sandbox-Environment',
    name: 'Dev Sandbox Environment',
    description: 'Local infrastructure sandbox utilizing LocalStack APIs and SSH containers to simulate and test local deployment playbooks.',
    status: 'idle',
    lastUpdated: '1 day ago',
    tags: ['LocalStack', 'Terraform', 'Linux'],
    collaborators: [
      { name: 'John Doe', initials: 'JD', color: 'bg-rose-500' },
    ],
  },
  {
    id: 'Production-Cluster-Setup',
    name: 'Production Cluster Setup',
    description: 'High-availability Kubernetes deployment manifest mapping Ingress traffic routing, PVC volume requests, ConfigMaps, and encrypted Secrets.',
    status: 'idle',
    lastUpdated: '3 days ago',
    tags: ['Kubernetes', 'Ingress', 'YAML'],
    collaborators: [
      { name: 'John Doe', initials: 'JD', color: 'bg-rose-500' },
      { name: 'Sara Connor', initials: 'SC', color: 'bg-emerald-500' },
      { name: 'Kyle Reese', initials: 'KR', color: 'bg-amber-500' },
      { name: 'Marcus Wright', initials: 'MW', color: 'bg-cyan-500' },
    ],
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, loadSession, logout } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Route protection
  useEffect(() => {
    // If we've finished loading and there is no token, bounce to login
    const checkedToken = localStorage.getItem('infracanvas_token');
    if (!checkedToken) {
      router.push('/login');
    }
  }, [token, router]);

  const handleOpenWorkspace = (projectId: string) => {
    router.push(`/workspace?project=${projectId}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-[#0A0F1D] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Icon icon="lucide:loader-2" className="animate-spin text-3xl text-primary" />
          <p className="text-sm font-medium tracking-wide">Securing session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0A0F1D] flex flex-col text-slate-200 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-[#0D1324]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-[#1A233D] shadow-md">
              <div className="h-4 w-4 rounded-md bg-gradient-to-br from-primary to-cyan-400"></div>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">OrchestrateOS</p>
              <p className="text-xs text-slate-400">Workspace Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#131A30]/50">
              <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase border border-primary/20">
                {user.name.slice(0, 2)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white">{user.name}</p>
                <p className="text-[10px] text-slate-400 leading-none">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl border border-slate-800 bg-[#131A30]/50 hover:bg-red-500/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Logout"
            >
              <Icon icon="lucide:log-out" className="text-lg" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow mx-auto w-full max-w-7xl px-6 py-12 lg:px-10 flex flex-col gap-10">
        
        {/* Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/40 pb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {user.name}!</h1>
            <p className="text-sm text-slate-400 mt-1">Select a visual workspace to start orchestrating or create a new design.</p>
          </div>
          <button
            onClick={() => alert('New project templates are disabled for local developer sandboxing.')}
            className="flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 active:scale-[0.98] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition cursor-pointer"
          >
            <Icon icon="lucide:plus" className="text-lg" />
            <span>Create Project</span>
          </button>
        </div>

        {/* Dashboard Metrics */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-[#131A30]/40 p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Projects</p>
              <p className="mt-2 text-2xl font-bold text-white">3</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/10">
              <Icon icon="lucide:folder" className="text-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-[#131A30]/40 p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Runs</p>
              <p className="mt-2 text-2xl font-bold text-white">0</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/10">
              <Icon icon="lucide:activity" className="text-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-[#131A30]/40 p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cloud Resources</p>
              <p className="mt-2 text-2xl font-bold text-white">12</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
              <Icon icon="lucide:server" className="text-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-[#131A30]/40 p-5 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Rooms</p>
              <p className="mt-2 text-2xl font-bold text-white">3</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/10">
              <Icon icon="lucide:users" className="text-xl" />
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex flex-col gap-6">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Icon icon="lucide:layers" className="text-primary text-lg" />
            <span>Active Orchestration Workspaces</span>
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PROJECTS.map((project) => (
              <div 
                key={project.id}
                className="rounded-[24px] border border-slate-850 bg-[#131A30]/30 hover:bg-[#131A30]/50 hover:border-slate-800 hover:shadow-2xl transition duration-300 p-6 flex flex-col justify-between shadow-xl relative group"
              >
                <div>
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Updated {project.lastUpdated}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        project.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 
                        project.status === 'deploying' ? 'bg-cyan-500 animate-pulse shadow-[0_0_8px_#06B6D4]' : 
                        'bg-slate-500'
                      }`}></span>
                      <span className="text-xs font-medium text-slate-400 capitalize">
                        {project.status === 'success' ? 'Deployment Success' : project.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition duration-200">
                    {project.name}
                  </h3>
                  
                  <p className="text-sm text-slate-400 mt-2.5 leading-relaxed line-clamp-3">
                    {project.description}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-slate-800/40 pt-4">
                  {/* Technology Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className="rounded-lg bg-[#18233C] px-2 py-1 text-[10px] font-semibold text-slate-300 border border-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Collaborator Avatars */}
                    <div className="flex -space-x-2.5 overflow-hidden">
                      {project.collaborators.map((c) => (
                        <div 
                          key={c.name}
                          className={`inline-block h-7 w-7 rounded-full ${c.color} text-white flex items-center justify-center text-[10px] font-bold border-2 border-[#0A0F1D]`}
                          title={c.name}
                        >
                          {c.initials}
                        </div>
                      ))}
                      <div className="inline-block h-7 w-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold border-2 border-[#0A0F1D] cursor-pointer" title="Invite User">
                        +
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenWorkspace(project.id)}
                      className="rounded-xl bg-slate-800 hover:bg-primary hover:text-white px-4 py-2 text-xs font-bold text-slate-300 transition duration-200 cursor-pointer flex items-center gap-1"
                    >
                      <span>Open Workspace</span>
                      <Icon icon="lucide:chevron-right" className="text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
