'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface Module {
  id: string;
  name: string;
  type: 'network' | 'database' | 'server' | 'gateway' | 'security';
  icon: string;
  description: string;
  color: string;
}

const ALL_MODULES: Module[] = [
  { id: 'vpc', name: 'VPC Network', type: 'network', icon: 'lucide:network', description: 'AWS VPC, public/private subnets, & IGW', color: 'cyan' },
  { id: 'postgres', name: 'RDS Postgres', type: 'database', icon: 'lucide:database', description: 'Managed Relational Database Service', color: 'violet' },
  { id: 'app-cluster', name: 'App Cluster', type: 'server', icon: 'lucide:server', description: 'Node.js API application servers', color: 'indigo' },
  { id: 'nginx-gw', name: 'Nginx Gateway', type: 'gateway', icon: 'lucide:box', description: 'Reverse proxy & public router', color: 'orange' },
  { id: 'cdn-shield', name: 'CDN & WAF Shield', type: 'security', icon: 'lucide:shield', description: 'CloudFront CDN edge protection', color: 'emerald' },
];

export default function InteractiveSandbox() {
  const [activeNodes, setActiveNodes] = useState<string[]>(['vpc', 'postgres', 'app-cluster']);
  const [codeTab, setCodeTab] = useState<'tf' | 'ansible'>('tf');
  const [copied, setCopied] = useState<boolean>(false);
  const [simState, setSimState] = useState<'idle' | 'compiling' | 'success'>('idle');
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'idle' | 'loading' | 'success'>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logs terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const toggleNode = (nodeId: string) => {
    if (simState === 'compiling') return;
    setSimState('idle');
    setNodeStatuses({});
    setLogs([]);
    
    // Core nodes (VPC, DB, Server) can't be removed, only Nginx and CDN are togglable
    if (nodeId === 'vpc' || nodeId === 'postgres' || nodeId === 'app-cluster') {
      return; // static core
    }

    setActiveNodes(prev => {
      if (prev.includes(nodeId)) {
        // If removing gateway, also remove CDN since it relies on gateway
        if (nodeId === 'nginx-gw') {
          return prev.filter(id => id !== 'nginx-gw' && id !== 'cdn-shield');
        }
        return prev.filter(id => id !== nodeId);
      } else {
        // Add node
        return [...prev, nodeId];
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getGeneratedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runSimulation = async () => {
    if (simState === 'compiling') return;
    setSimState('compiling');
    setLogs([]);
    
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    // Initial compilation
    addLog('⚡ [Compiler] Analyzing visual canvas node relationship tree...');
    await sleep(800);
    
    // Node VPC compilation
    setNodeStatuses(prev => ({ ...prev, vpc: 'loading' }));
    addLog('🔧 [Terraform] Initializing AWS provider plugins...');
    await sleep(600);
    addLog('🔧 [Terraform] Creating resource: aws_vpc.main (10.0.0.0/16)...');
    await sleep(700);
    addLog('🔧 [Terraform] Creating resource: aws_subnet.public_a & aws_subnet.private_b...');
    await sleep(500);
    setNodeStatuses(prev => ({ ...prev, vpc: 'success' }));
    addLog('✅ [LocalStack Sandbox] VPC Environment simulated locally (Container ID: net-mock-91)');
    await sleep(600);

    // Node Postgres compilation
    setNodeStatuses(prev => ({ ...prev, postgres: 'loading' }));
    addLog('🔧 [Terraform] Creating resource: aws_db_instance.postgres (engine: postgres:15)...');
    await sleep(800);
    setNodeStatuses(prev => ({ ...prev, postgres: 'success' }));
    addLog('✅ [LocalStack Sandbox] Postgres mock container listening on localhost:5432');
    await sleep(500);

    // Node App-Cluster compilation
    setNodeStatuses(prev => ({ ...prev, 'app-cluster': 'loading' }));
    addLog('🔧 [Terraform] Provisioning: aws_instance.app_nodes [count=2] (Ubuntu 22.04)...');
    await sleep(700);
    addLog('📦 [Ansible] Generating dynamic inventory from Terraform resource states...');
    await sleep(600);
    addLog('📦 [Ansible] SSH handshake established with local target nodes: 172.20.0.4, 172.20.0.5');
    await sleep(500);
    addLog('📦 [Ansible] Task [Update apt cache] ➔ OK');
    await sleep(600);
    addLog('📦 [Ansible] Task [Install Node.js packages] ➔ INSTALLED');
    await sleep(700);
    setNodeStatuses(prev => ({ ...prev, 'app-cluster': 'success' }));
    addLog('✅ [Sandbox] Application containers running & listening on port 8080');
    await sleep(500);

    // Node Nginx gateway configuration (if active)
    if (activeNodes.includes('nginx-gw')) {
      setNodeStatuses(prev => ({ ...prev, 'nginx-gw': 'loading' }));
      addLog('🔧 [Terraform] Creating resource: aws_instance.nginx_gateway...');
      await sleep(600);
      addLog('📦 [Ansible] SSH handshake established with gateway node: 172.20.0.3');
      await sleep(500);
      addLog('📦 [Ansible] Task [Install Nginx webserver] ➔ OK');
      await sleep(600);
      addLog('📦 [Ansible] Task [Configure reverse proxy upstream to app_servers] ➔ OK');
      await sleep(500);
      setNodeStatuses(prev => ({ ...prev, 'nginx-gw': 'success' }));
      addLog('✅ [Sandbox] Nginx gateway listening on public http://localhost:80');
      await sleep(500);
    }

    // Node CDN Shield configuration (if active)
    if (activeNodes.includes('cdn-shield')) {
      setNodeStatuses(prev => ({ ...prev, 'cdn-shield': 'loading' }));
      addLog('🔧 [Terraform] Provisioning AWS CloudFront CDN distribution edge router...');
      await sleep(700);
      addLog('🛡️ [WAF Ruleset] Injecting OWASP core threat filtering policies...');
      await sleep(600);
      setNodeStatuses(prev => ({ ...prev, 'cdn-shield': 'success' }));
      addLog('✅ [LocalStack Sandbox] CloudFront CDN running edge proxy route');
      await sleep(500);
    }

    // Final validation
    addLog('🔍 [Healthcheck] Launching HTTP connection check to internal ingress...');
    await sleep(800);
    addLog('🎉 [Success] Status 200 OK received from upstream stack in 12ms!');
    addLog('🚀 [Sandbox Runtime] Deployment simulation successful! 0 cost, zero cloud waste.');
    setSimState('success');
  };

  const getGeneratedCode = () => {
    if (codeTab === 'tf') {
      let code = `# =================================================================
# INFRA CANVAS GENERATED TERRAFORM IAC
# =================================================================

# 1. Network Layer (AWS VPC)
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "infracanvas-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
`;

      if (activeNodes.includes('postgres')) {
        code += `
# 2. Relational Database Instance (AWS RDS)
resource "aws_db_instance" "postgres" {
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t3.micro"
  db_name                = "app_production"
  username               = "canvas_user"
  password               = var.database_root_password
  skip_final_snapshot    = true
}
`;
      }

      if (activeNodes.includes('app-cluster')) {
        code += `
# 3. Application Execution Nodes (VM Instances)
resource "aws_instance" "app_servers" {
  count         = 2
  ami           = "ami-0c7217cdde317cfec" # Ubuntu Server 22.04 LTS
  instance_type = "t3.medium"
  subnet_id     = aws_subnet.public.id
  
  tags = { Name = "infracanvas-app-\${count.index}" }
}
`;
      }

      if (activeNodes.includes('nginx-gw')) {
        code += `
# 4. Public Gateway Router (Nginx Proxy)
resource "aws_instance" "nginx_gateway" {
  ami           = "ami-0c7217cdde317cfec"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  
  tags = { Name = "infracanvas-gateway" }
}
`;
      }

      if (activeNodes.includes('cdn-shield')) {
        code += `
# 5. Edge CDN Protection (CloudFront & AWS WAF)
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_instance.nginx_gateway.public_dns
    origin_id   = "NginxProxyOrigin"
  }
  enabled             = true
  default_cache_behavior {
    target_origin_id = "NginxProxyOrigin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}
`;
      }

      return code;
    } else {
      // Ansible YAML
      let code = `# =================================================================
# INFRA CANVAS GENERATED ANSIBLE CONFIGURATION PLAYBOOK
# =================================================================
---
- name: Core Node Configuration
  hosts: app_servers
  become: true
  vars:
    db_address: "{{ terraform_outputs.db_address }}"
  tasks:
    - name: Update package index
      apt:
        update_cache: yes

    - name: Install Node.js runtime and packages
      apt:
        name: ["nodejs", "npm", "git"]
        state: present
`;

      if (activeNodes.includes('postgres')) {
        code += `
    - name: Ensure PostgreSQL client database tools
      apt:
        name: postgresql-client
        state: present

    - name: Validate database schema availability
      wait_for:
        host: "{{ db_address }}"
        port: 5432
        timeout: 30
`;
      }

      if (activeNodes.includes('nginx-gw')) {
        code += `
- name: Configure Web Ingress Gateway
  hosts: nginx_gateway
  become: true
  tasks:
    - name: Install Nginx proxy package
      apt:
        name: nginx
        state: present

    - name: Template active virtual host upstream routing
      template:
        src: files/nginx_upstream.conf.j2
        dest: /etc/nginx/sites-available/default
      notify: Restart Nginx service
`;
      }

      if (activeNodes.includes('cdn-shield')) {
        code += `
    - name: Apply rate limit firewall filtering rules (WAF Edge Backup)
      iptables:
        chain: INPUT
        protocol: tcp
        destination_port: 80
        match: limit
        limit: 150/minute
        jump: ACCEPT
`;
      }

      return code;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto rounded-3xl border border-white/[0.08] bg-slate-950/40 p-3 md:p-6 shadow-2xl backdrop-blur-2xl neon-border-violet relative overflow-hidden">
      
      {/* Background radial effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
      
      <div className="grid gap-6 lg:grid-cols-12 relative z-10">
        
        {/* Sidebar module catalogue */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="border border-white/[0.06] rounded-2xl bg-secondary/30 p-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Icon icon="lucide:layout-grid" className="text-sm text-cyan-400" /> Module Catalogue
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Configure layout topology</p>
            
            <div className="flex flex-col gap-2 mt-4">
              {ALL_MODULES.map((mod) => {
                const isActive = activeNodes.includes(mod.id);
                const isCore = mod.id === 'vpc' || mod.id === 'postgres' || mod.id === 'app-cluster';
                
                return (
                  <button
                    key={mod.id}
                    onClick={() => toggleNode(mod.id)}
                    disabled={isCore || simState === 'compiling'}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group ${
                      isActive
                        ? mod.color === 'cyan' ? 'border-cyan-500/35 bg-cyan-500/10 text-white'
                          : mod.color === 'violet' ? 'border-violet-500/35 bg-violet-500/10 text-white'
                          : mod.color === 'indigo' ? 'border-indigo-500/35 bg-indigo-500/10 text-white'
                          : mod.color === 'orange' ? 'border-orange-500/35 bg-orange-500/10 text-white'
                          : 'border-emerald-500/35 bg-emerald-500/10 text-white'
                        : 'border-white/[0.06] bg-slate-900/40 text-muted-foreground hover:bg-slate-900/80 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-slate-950/60' : 'bg-slate-900/60'}`}>
                        <Icon 
                          icon={mod.icon} 
                          className={`text-lg transition-transform group-hover:scale-110 ${
                            isActive 
                              ? mod.color === 'cyan' ? 'text-cyan-400' 
                                : mod.color === 'violet' ? 'text-violet-400'
                                : mod.color === 'indigo' ? 'text-indigo-400'
                                : mod.color === 'orange' ? 'text-orange-400'
                                : 'text-emerald-400'
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{mod.name}</div>
                        <div className="text-[10px] opacity-70 font-normal leading-none mt-1 line-clamp-1">{mod.description}</div>
                      </div>
                    </div>
                    {!isCore && (
                      <div className="pl-2">
                        {isActive ? (
                          <Icon icon="lucide:check" className="text-sm text-cyan-400" />
                        ) : (
                          <Icon icon="lucide:plus" className="text-sm text-muted-foreground group-hover:text-foreground" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Simulator controls */}
          <div className="border border-white/[0.06] rounded-2xl bg-secondary/30 p-4 flex flex-col gap-3">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Local Sandbox</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Test complete deployment zero-cost</p>
            </div>
            
            <button
              onClick={runSimulation}
              disabled={simState === 'compiling'}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ${
                simState === 'compiling'
                  ? 'bg-slate-800 text-muted-foreground cursor-not-allowed border border-white/[0.05]'
                  : 'bg-primary text-white hover:opacity-90 active:scale-95 border border-primary-foreground/20 animate-pulse hover:animate-none'
              }`}
            >
              {simState === 'compiling' ? (
                <>
                  <Icon icon="lucide:loader-2" className="animate-spin text-sm" />
                  <span>Simulating stack...</span>
                </>
              ) : (
                <>
                  <Icon icon="lucide:play" className="text-sm" />
                  <span>Simulate Local Sandbox</span>
                </>
              )}
            </button>
            
            {simState === 'success' && (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-lg justify-center animate-in fade-in">
                <Icon icon="lucide:check-circle" className="text-sm animate-bounce" />
                <span>Simulation Complete (100% OK)</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Middle interactive network topology canvas */}
        <div className="lg:col-span-5 border border-white/[0.06] rounded-2xl bg-slate-950/70 bg-dot-pattern flex flex-col relative min-h-[380px] md:min-h-[440px] overflow-hidden">
          
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/90 border border-white/[0.06] px-3 py-1.5 rounded-full z-10 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-[10px] font-medium tracking-wide text-slate-300">Live Visual Canvas Topology</span>
          </div>
          
          {/* Node objects rendered in canvas space */}
          <div className="flex-1 flex flex-col justify-center items-center relative py-12 px-6">
            
            {/* SVG connections overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="gradient-vpc-db" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="gradient-vpc-app" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="gradient-gw-app" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="gradient-cdn-gw" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Path: VPC -> DB */}
              {activeNodes.includes('vpc') && activeNodes.includes('postgres') && (
                <>
                  <path d="M 120 120 C 120 180, 180 180, 180 240" fill="none" stroke="url(#gradient-vpc-db)" strokeWidth="2" />
                  <path d="M 120 120 C 120 180, 180 180, 180 240" fill="none" stroke="#8b5cf6" strokeWidth="2" className="animate-path-flow" />
                </>
              )}

              {/* Path: VPC -> App-Cluster */}
              {activeNodes.includes('vpc') && activeNodes.includes('app-cluster') && (
                <>
                  <path d="M 120 120 C 120 180, 300 180, 300 240" fill="none" stroke="url(#gradient-vpc-app)" strokeWidth="2" />
                  <path d="M 120 120 C 120 180, 300 180, 300 240" fill="none" stroke="#6366f1" strokeWidth="2" className="animate-path-flow" />
                </>
              )}

              {/* Path: Nginx-Gateway -> App-Cluster */}
              {activeNodes.includes('nginx-gw') && activeNodes.includes('app-cluster') && (
                <>
                  <path d="M 300 120 Q 300 180, 300 240" fill="none" stroke="url(#gradient-gw-app)" strokeWidth="2" />
                  <path d="M 300 120 Q 300 180, 300 240" fill="none" stroke="#f97316" strokeWidth="2" className="animate-path-flow" />
                </>
              )}

              {/* Path: CDN -> Gateway */}
              {activeNodes.includes('cdn-shield') && activeNodes.includes('nginx-gw') && (
                <>
                  <path d="M 300 40 Q 300 80, 300 120" fill="none" stroke="url(#gradient-cdn-gw)" strokeWidth="2" />
                  <path d="M 300 40 Q 300 80, 300 120" fill="none" stroke="#10b981" strokeWidth="2" className="animate-path-flow" />
                </>
              )}
            </svg>

            {/* CDN Shield node (Optional top row) */}
            {activeNodes.includes('cdn-shield') && (
              <div 
                className="absolute z-20 transition-all duration-500 animate-scale-in"
                style={{ top: '15px', left: 'calc(50% - 70px)' }}
              >
                <div className={`w-[140px] px-3 py-2 rounded-xl bg-slate-900 border text-center relative ${
                  nodeStatuses['cdn-shield'] === 'success' ? 'neon-border-emerald bg-emerald-950/10' :
                  nodeStatuses['cdn-shield'] === 'loading' ? 'neon-border-cyan border-cyan-500 animate-pulse' :
                  'border-white/[0.08]'
                }`}>
                  <div className="absolute -top-1 right-2 flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      nodeStatuses['cdn-shield'] === 'success' ? 'bg-emerald-400' :
                      nodeStatuses['cdn-shield'] === 'loading' ? 'bg-cyan-400' : 'bg-slate-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      nodeStatuses['cdn-shield'] === 'success' ? 'bg-emerald-500' :
                      nodeStatuses['cdn-shield'] === 'loading' ? 'bg-cyan-500' : 'bg-slate-500'
                    }`}></span>
                  </div>
                  <Icon icon="lucide:shield" className={`text-xl mx-auto ${nodeStatuses['cdn-shield'] === 'success' ? 'text-emerald-400 neon-glow-emerald' : 'text-emerald-500'}`} />
                  <p className="text-[11px] font-bold text-white mt-1">CDN & WAF</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">edge.cloud.local</p>
                </div>
              </div>
            )}

            {/* Row 1: Left Node - VPC Network */}
            <div className="absolute" style={{ top: '80px', left: '40px' }}>
              <div className={`w-[130px] px-3 py-2 rounded-xl bg-slate-900 border transition-all ${
                nodeStatuses.vpc === 'success' ? 'neon-border-emerald bg-emerald-950/10' :
                nodeStatuses.vpc === 'loading' ? 'neon-border-cyan border-cyan-500 animate-pulse' :
                'border-white/[0.08]'
              }`}>
                <div className="absolute -top-1 right-2 flex h-2 w-2">
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    nodeStatuses.vpc === 'success' ? 'bg-emerald-500' :
                    nodeStatuses.vpc === 'loading' ? 'bg-cyan-500 animate-ping' : 'bg-cyan-500'
                  }`}></span>
                </div>
                <Icon icon="lucide:network" className={`text-xl ${nodeStatuses.vpc === 'success' ? 'text-emerald-400 neon-glow-emerald' : 'text-cyan-400'}`} />
                <p className="text-[11px] font-bold text-white mt-1">VPC Network</p>
                <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">10.0.0.0/16</p>
              </div>
            </div>

            {/* Row 1: Right Node - Gateway (Optional) */}
            {activeNodes.includes('nginx-gw') && (
              <div className="absolute z-10 transition-all duration-500 animate-scale-in" style={{ top: '80px', right: '40px' }}>
                <div className={`w-[130px] px-3 py-2 rounded-xl bg-slate-900 border transition-all ${
                  nodeStatuses['nginx-gw'] === 'success' ? 'neon-border-emerald bg-emerald-950/10' :
                  nodeStatuses['nginx-gw'] === 'loading' ? 'neon-border-cyan border-cyan-500 animate-pulse' :
                  'border-white/[0.08]'
                }`}>
                  <div className="absolute -top-1 right-2 flex h-2 w-2">
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      nodeStatuses['nginx-gw'] === 'success' ? 'bg-emerald-500' :
                      nodeStatuses['nginx-gw'] === 'loading' ? 'bg-cyan-500 animate-ping' : 'bg-orange-500'
                    }`}></span>
                  </div>
                  <Icon icon="lucide:box" className={`text-xl ${nodeStatuses['nginx-gw'] === 'success' ? 'text-emerald-400 neon-glow-emerald' : 'text-orange-400'}`} />
                  <p className="text-[11px] font-bold text-white mt-1">Nginx Gateway</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">nginx.local (port 80)</p>
                </div>
              </div>
            )}

            {/* Row 2: Left Node - Database */}
            <div className="absolute" style={{ bottom: '40px', left: '100px' }}>
              <div className={`w-[135px] px-3 py-2 rounded-xl bg-slate-900 border transition-all ${
                nodeStatuses.postgres === 'success' ? 'neon-border-emerald bg-emerald-950/10' :
                nodeStatuses.postgres === 'loading' ? 'neon-border-cyan border-cyan-500 animate-pulse' :
                'border-white/[0.08]'
              }`}>
                <div className="absolute -top-1 right-2 flex h-2 w-2">
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    nodeStatuses.postgres === 'success' ? 'bg-emerald-500' :
                    nodeStatuses.postgres === 'loading' ? 'bg-cyan-500 animate-ping' : 'bg-violet-500'
                  }`}></span>
                </div>
                <Icon icon="lucide:database" className={`text-xl ${nodeStatuses.postgres === 'success' ? 'text-emerald-400 neon-glow-emerald' : 'text-violet-400'}`} />
                <p className="text-[11px] font-bold text-white mt-1">RDS Postgres</p>
                <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">db.local (port 5432)</p>
              </div>
            </div>

            {/* Row 2: Right Node - App Cluster */}
            <div className="absolute" style={{ bottom: '40px', right: '100px' }}>
              <div className={`w-[135px] px-3 py-2 rounded-xl bg-slate-900 border transition-all ${
                nodeStatuses['app-cluster'] === 'success' ? 'neon-border-emerald bg-emerald-950/10' :
                nodeStatuses['app-cluster'] === 'loading' ? 'neon-border-cyan border-cyan-500 animate-pulse' :
                'border-white/[0.08]'
              }`}>
                <div className="absolute -top-1 right-2 flex h-2 w-2">
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    nodeStatuses['app-cluster'] === 'success' ? 'bg-emerald-500' :
                    nodeStatuses['app-cluster'] === 'loading' ? 'bg-cyan-500 animate-ping' : 'bg-indigo-500'
                  }`}></span>
                </div>
                <Icon icon="lucide:server" className={`text-xl ${nodeStatuses['app-cluster'] === 'success' ? 'text-emerald-400 neon-glow-emerald' : 'text-indigo-400'}`} />
                <p className="text-[11px] font-bold text-white mt-1">App Cluster</p>
                <p className="text-[8px] text-muted-foreground mt-0.5 font-mono">2 instances (port 8080)</p>
              </div>
            </div>

          </div>
          
          {/* Simulated shell terminal */}
          <div className="h-44 border-t border-white/[0.06] bg-slate-950/90 flex flex-col font-mono text-[10px] overflow-hidden rounded-b-2xl">
            <div className="bg-slate-900 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <Icon icon="lucide:terminal" className="text-cyan-400 text-xs" />
                <span className="font-semibold text-slate-300">DevOps Sandbox Shell Console</span>
              </div>
              <span className="text-[8px] bg-slate-800 px-2 py-0.5 rounded text-muted-foreground font-mono">172.20.0.1</span>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-1.5 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic h-full flex items-center justify-center">
                  Sandbox ready. Click &quot;Simulate Local Sandbox&quot; to test.
                </div>
              ) : (
                logs.map((log, index) => {
                  let color = 'text-slate-300';
                  if (log.startsWith('✅') || log.includes('SUCCESS') || log.startsWith('🎉')) {
                    color = 'text-emerald-400';
                  } else if (log.startsWith('🔧')) {
                    color = 'text-cyan-400';
                  } else if (log.startsWith('📦')) {
                    color = 'text-indigo-400';
                  } else if (log.startsWith('⚡')) {
                    color = 'text-violet-400';
                  } else if (log.startsWith('🛡️')) {
                    color = 'text-emerald-500';
                  } else if (log.includes('Pinging')) {
                    color = 'text-slate-400';
                  }

                  return (
                    <div key={index} className={`leading-relaxed whitespace-pre-wrap ${color} animate-in fade-in slide-in-from-bottom-1 duration-100`}>
                      {log}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
        
        {/* Right side generated IaC Code compiler viewer */}
        <div className="lg:col-span-4 border border-white/[0.06] rounded-2xl bg-[#030712]/90 flex flex-col overflow-hidden min-h-[380px] md:min-h-[440px]">
          
          {/* Header tabs for code panel */}
          <div className="bg-[#090d16] px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCodeTab('tf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                  codeTab === 'tf' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Terraform (HCL)
              </button>
              <button
                onClick={() => setCodeTab('ansible')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                  codeTab === 'ansible' 
                    ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ansible (YAML)
              </button>
            </div>
            
            <button 
              onClick={handleCopy}
              className="p-1.5 hover:bg-slate-900 border border-transparent hover:border-white/[0.06] rounded-lg transition text-slate-400 hover:text-white"
              title="Copy compiled code"
            >
              {copied ? (
                <Icon icon="lucide:check-circle" className="text-sm text-emerald-400" />
              ) : (
                <Icon icon="lucide:copy" className="text-sm" />
              )}
            </button>
          </div>
          
          {/* Animated Code contents */}
          <div className="flex-1 p-4 overflow-y-auto font-mono text-[10px] md:text-[11px] leading-relaxed text-slate-300 scrollbar-thin">
            <pre className="w-full">
              <code>
                {getGeneratedCode().split('\n').map((line, i) => {
                  let lineClass = 'text-slate-400';
                  if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
                    lineClass = 'text-slate-600 font-italic';
                  } else if (line.includes('resource') || line.includes('hosts:') || line.includes('tasks:') || line.includes('vars:')) {
                    lineClass = 'text-cyan-400 font-semibold';
                  } else if (line.includes('name:') || line.includes('apt:') || line.includes('template:') || line.includes('wait_for:')) {
                    lineClass = 'text-violet-400 font-semibold';
                  } else if (line.includes('true') || line.includes('yes') || line.includes('present') || line.includes('Count') || line.includes('count.index')) {
                    lineClass = 'text-orange-400';
                  } else if (line.includes('=') || line.includes(':')) {
                    lineClass = 'text-emerald-300';
                  }
                  
                  return (
                    <div key={i} className="flex hover:bg-white/[0.02] px-2 -mx-2 rounded">
                      <span className="w-6 shrink-0 text-slate-700 select-none text-right pr-2 border-r border-white/[0.04] mr-3 font-mono text-[9px] tabular-nums">
                        {i + 1}
                      </span>
                      <span className={lineClass}>{line}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
          
        </div>
        
      </div>
    </div>
  );
}
