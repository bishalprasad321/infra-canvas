'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  ReactFlowProvider, 
  useReactFlow,
  Connection,
  Edge,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Icon } from '@iconify/react';
import { clsx } from 'clsx';

import useCanvasStore from '../store/useCanvasStore';
import ReactFlowCanvasNode from '../components/ReactFlowCanvasNode';
import { generateAnsibleYAML } from '../lib/exportYaml';
import { downloadZipBundle, generateBundleFiles } from '../lib/bundleGenerator';
import { DEFAULT_INSTANCE_PARAMS, DEFAULT_SG_PARAMS } from '../lib/terraformDefaults';

// Define layout components inside the workspace directory for encapsulation

// --- TYPES & INTERFACES ---

interface Tag {
  key: string;
  value: string;
}

interface NodeParameters {
  instanceName: string;
  amiId: string;
  instanceType: string;
  subnetId: string;
  rootVolumeSize: number;
  tags: Tag[];
}

interface LibraryNode {
  id: string;
  tech: 'Terraform' | 'Ansible' | 'Kubernetes' | 'Source' | 'Target';
  icon: string;
  title: string;
  description: string;
  category: string;
}

// --- HELPER SUB-COMPONENTS ---

// Header Component
interface HeaderProps {
  selectedProject: string;
  selectedOS: string;
  onOSChange: (os: string) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExport: () => void;
  onExportFormat: (format: string) => void;
  onDeploy: () => void;
  deployStatus: string;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  autoDestroy: boolean;
  onAutoDestroyChange: (val: boolean) => void;
  onDestroy: () => void;
}

const Header: React.FC<HeaderProps> = ({
  selectedProject,
  selectedOS,
  onOSChange,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExport,
  onExportFormat,
  onDeploy,
  deployStatus,
  isTerminalOpen,
  onToggleTerminal,
  autoDestroy,
  onAutoDestroyChange,
  onDestroy,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-card/85 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Workspace breadcrumbs & OS Toggle */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md">
            <Icon icon="lucide:layers" className="text-primary-foreground text-lg" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            InfraFlow
          </span>
        </div>

        <div className="h-4 w-[1px] bg-border"></div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Project Alpha</span>
          <Icon icon="lucide:chevron-right" className="text-muted-foreground text-xs" />
          <span className="text-foreground font-medium font-heading">{selectedProject}</span>
          <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-wider font-semibold rounded border border-emerald-500/20 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
          </span>
        </div>

        <div className="h-4 w-[1px] bg-border hidden md:block"></div>

        {/* TODO: OS Environment Selector is currently visual-only. Toggling this state does not alter the generated Ansible playbooks or Terraform templates. Future engineers should integrate this parameters/OS state into the code generator. */}
        {/* OS Environment Selector */}
        <div className="hidden md:flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
          {['Linux', 'macOS', 'Windows'].map((os) => (
            <button
              key={os}
              onClick={() => onOSChange(os)}
              className={clsx(
                "px-2 py-1 text-xs rounded-md font-medium flex items-center gap-1 transition-all",
                selectedOS === os
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon icon={os === 'macOS' ? "lucide:smartphone" : "lucide:monitor"} className="text-xs" />
              {os}
            </button>
          ))}
        </div>
      </div>

      {/* TODO: Collaboration Stack & Live Syncing status is currently a static UI mock. There is no actual real-time multi-user editing backend. Implement WebSockets or CRDTs (e.g., Y.js) here to enable real-time collaboration. */}
      {/* Center: Collaboration Stack & Live Sync */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="flex items-center -space-x-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary overflow-hidden relative group cursor-pointer" title="Sarah (Terraform Architect)">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80" alt="Sarah" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-card"></span>
          </div>
          <div className="h-8 w-8 rounded-full border-2 border-[#00A4FF] overflow-hidden relative group cursor-pointer" title="Alex (Ansible Specialist)">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80" alt="Alex" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-card"></span>
          </div>
          <div className="h-8 w-8 rounded-full border-2 border-[#326CE5] overflow-hidden relative group cursor-pointer" title="Dave (K8s Lead)">
            <img src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&h=80&q=80" alt="Dave" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-card"></span>
          </div>
          <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-border transition-colors">
            +2
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
          <Icon icon="lucide:refresh-cw" className="animate-spin text-xs" />
          <span>Live Syncing</span>
        </div>
      </div>

      {/* Right: Zoom Controls & Export Split-Button */}
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
          <button onClick={onZoomOut} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors" title="Zoom Out">
            <Icon icon="lucide:minus" className="text-sm" />
          </button>
          <span onClick={onZoomReset} className="px-2 text-xs font-mono font-semibold text-foreground select-none cursor-pointer hover:text-primary transition-colors">
            {zoomLevel}%
          </span>
          <button onClick={onZoomIn} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors" title="Zoom In">
            <Icon icon="lucide:plus" className="text-sm" />
          </button>
          <div className="w-[1px] h-4 bg-border mx-1"></div>
          <button onClick={onZoomReset} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors" title="Reset Zoom">
            <Icon icon="lucide:maximize" className="text-sm" />
          </button>
        </div>

        {/* Export Split Button */}
        <div className="flex items-center relative">
          <button
            onClick={onExport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-4 py-2 rounded-l-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            <Icon icon="lucide:download" className="text-base" />
            <span>Export Code</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-l border-border/20 p-2 rounded-r-lg flex items-center justify-center transition-all shadow-lg shadow-primary/20 h-full"
            >
              <Icon icon="lucide:chevron-down" className="text-base" />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}></div>
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl transition-all duration-150 z-50 p-1">
                  <button
                    onClick={() => { onExportFormat('tf'); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Icon icon="lucide:file" className="text-primary text-sm" />
                    <span>Terraform HCL (.tf)</span>
                  </button>
                  <button
                    onClick={() => { onExportFormat('yml'); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Icon icon="lucide:clipboard" className="text-[#00A4FF] text-sm" />
                    <span>Ansible YAML (.yml)</span>
                  </button>
                  <button
                    onClick={() => { onExportFormat('json'); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Icon icon="lucide:layers" className="text-[#326CE5] text-sm" />
                    <span>Kubernetes JSON (.json)</span>
                  </button>
                  <div className="h-[1px] bg-border my-1"></div>
                  <button
                    onClick={() => { onExportFormat('zip'); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted font-medium text-emerald-400 flex items-center gap-2 transition-colors"
                  >
                    <Icon icon="lucide:folder" className="text-emerald-400 text-sm" />
                    <span>Download Bundle (.zip)</span>
                  </button>
                </div>
              </>
            )}
        </div>
      </div>

      {/* Ephemeral Mode Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 select-none">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Icon icon="lucide:clock" className="text-amber-400 text-xs" />
            Auto-Cleanup
          </span>
          <button
            onClick={() => onAutoDestroyChange(!autoDestroy)}
            className={clsx(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              autoDestroy ? "bg-amber-500" : "bg-muted"
            )}
          >
            <span
              className={clsx(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                autoDestroy ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Deploy Button */}
        <button
          onClick={onDeploy}
          disabled={deployStatus === 'RUNNING' || deployStatus === 'PENDING'}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/20 cursor-pointer disabled:cursor-not-allowed"
        >
          {deployStatus === 'RUNNING' || deployStatus === 'PENDING' ? (
            <Icon icon="lucide:loader-2" className="text-base animate-spin" />
          ) : (
            <Icon icon="lucide:play" className="text-base" />
          )}
          <span>Deploy</span>
        </button>

        {/* Destroy Button */}
        <button
          onClick={onDestroy}
          disabled={deployStatus === 'RUNNING' || deployStatus === 'PENDING' || autoDestroy}
          className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-rose-950/20 cursor-pointer disabled:cursor-not-allowed"
          title={autoDestroy ? "Destroy is disabled when Auto-Cleanup is enabled" : "Tear Down All Canvas Provisioned Resources"}
        >
          <Icon icon="lucide:trash-2" className="text-base" />
          <span>Destroy</span>
        </button>

        {/* Toggle Terminal Button */}
        <button
          onClick={onToggleTerminal}
          className={clsx(
            "p-2 rounded-lg border border-border flex items-center justify-center transition-all cursor-pointer h-[38px] w-[38px]",
            isTerminalOpen ? "bg-primary/20 text-primary border-primary" : "bg-card text-muted-foreground hover:text-foreground"
          )}
          title="Toggle Terminal Console"
        >
          <Icon icon="lucide:terminal" className="text-base" />
        </button>
      </div>
    </header>
  );
};

// NodeCard Component (Library Panel Item)
interface NodeCardProps {
  node: LibraryNode;
  onAddNode: (node: LibraryNode) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, onAddNode }) => {
  const techColorClass = {
    Terraform: 'bg-primary/10 text-primary border-primary/20',
    Ansible: 'bg-[#00A4FF]/10 text-[#00A4FF] border-[#00A4FF]/20',
    Kubernetes: 'bg-[#326CE5]/10 text-[#326CE5] border-[#326CE5]/20',
    Source: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20',
    Target: 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20',
  }[node.tech];

  const hoverBorderClass = {
    Terraform: 'hover:border-primary/50 hover:shadow-primary/5',
    Ansible: 'hover:border-[#00A4FF]/50 hover:shadow-[#00A4FF]/5',
    Kubernetes: 'hover:border-[#326CE5]/50 hover:shadow-[#326CE5]/5',
    Source: 'hover:border-[#D97706]/50 hover:shadow-[#D97706]/5',
    Target: 'hover:border-[#0D9488]/50 hover:shadow-[#0D9488]/5',
  }[node.tech];

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow-node-id', node.id);
    event.dataTransfer.setData('application/reactflow-node-tech', node.tech);
    event.dataTransfer.setData('application/reactflow-node-icon', node.icon);
    event.dataTransfer.setData('application/reactflow-node-title', node.title);
    event.dataTransfer.setData('application/reactflow-node-description', node.description);
    event.dataTransfer.setData('application/reactflow-node-category', node.category);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      onClick={() => onAddNode(node)}
      draggable
      onDragStart={onDragStart}
      className={clsx(
        "group bg-muted/60 hover:bg-muted border border-border rounded-xl p-3 cursor-grab hover:cursor-grabbing transition-all hover:shadow-lg transform hover:-translate-y-0.5",
        hoverBorderClass
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className={clsx("px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wide", techColorClass)}>
          {node.tech}
        </span>
        <Icon icon="lucide:plus" className="text-muted-foreground group-hover:text-foreground text-sm transition-colors" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
        <Icon icon={node.icon} className={clsx("text-sm", node.tech === 'Terraform' ? 'text-primary' : node.tech === 'Ansible' ? 'text-[#00A4FF]' : node.tech === 'Source' ? 'text-[#D97706]' : node.tech === 'Target' ? 'text-[#0D9488]' : 'text-[#326CE5]')} />
        {node.title}
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
    </div>
  );
};

// LibraryPanel Component
interface LibraryPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  techFilter: string;
  onTechFilterSelect: (tech: string) => void;
  libraryNodes: LibraryNode[];
  onAddNode: (node: LibraryNode) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  collapsed,
  onToggle,
  searchQuery,
  onSearchChange,
  techFilter,
  onTechFilterSelect,
  libraryNodes,
  onAddNode,
}) => {
  const filteredNodes = libraryNodes.filter((node) => {
    const matchesSearch = node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTech = techFilter === 'All' || node.tech === techFilter;
    return matchesSearch && matchesTech;
  });

  const categories = Array.from(new Set(filteredNodes.map((n) => n.category)));

  return (
    <aside className={clsx(
      "bg-card/95 backdrop-blur-md flex flex-col shrink-0 z-20 transition-all duration-300 relative select-none overflow-visible",
      collapsed ? "w-0 border-r-0" : "w-80 border-r border-border"
    )}>
      {/* Sliding Window Container */}
      <div className="w-full h-full overflow-hidden">
        {/* Fixed Width Content Panel */}
        <div className="w-80 h-full flex flex-col">
          {/* Search & Quick Filters */}
          <div className="p-4 border-b border-border flex flex-col gap-3">
            <div className="relative">
              <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search automation nodes..."
                className="w-full bg-muted border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            {/* Technology Quick Filters */}
            <div className="flex flex-wrap gap-1">
              {['All', 'Source', 'Target', 'Terraform', 'Ansible', 'Kubernetes'].map((tech) => (
                <button
                  key={tech}
                  onClick={() => onTechFilterSelect(tech)}
                  className={clsx(
                    "flex-1 min-w-[42px] py-1.5 px-1 border border-border rounded-md text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer",
                    techFilter === tech
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  {tech === 'All' ? 'All' : tech === 'Terraform' ? 'TF' : tech === 'Ansible' ? 'Ans' : tech === 'Kubernetes' ? 'K8s' : tech === 'Target' ? 'Cloud' : 'Repo'}
                </button>
              ))}
            </div>
          </div>

          {/* Draggable/Clickable Nodes List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Icon icon="lucide:layers" className="text-xs" />
                  {category}
                </h3>
                <div className="space-y-2.5">
                  {filteredNodes
                    .filter((n) => n.category === category)
                    .map((node) => (
                      <NodeCard key={node.id} node={node} onAddNode={onAddNode} />
                    ))}
                </div>
              </div>
            ))}
            {filteredNodes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No matching automation blocks found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse Trigger Button */}
      <button
        onClick={onToggle}
        className="absolute -right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md hover:shadow-primary/10 transition-all z-30 cursor-pointer"
        title="Toggle Library Panel"
      >
        <Icon icon={collapsed ? "lucide:arrow-right" : "lucide:arrow-left"} className="text-xs" />
      </button>
    </aside>
  );
};

// CanvasControls Component
interface CanvasControlsProps {
  activeTool: string;
  onToolSelect: (tool: string) => void;
  onReset: () => void;
}

const CanvasControls: React.FC<CanvasControlsProps> = ({ activeTool, onToolSelect, onReset }) => {
  // TODO: Canvas pointer tools (select, pan, link) are currently visual-only toggles. Clicking them updates the local activeTool state, but does not alter the ReactFlow interaction modes. Future engineers should connect this state to ReactFlow controls (e.g. panOnDrag, selectNodesOnDrag).
  return (
    <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-card/90 backdrop-blur border border-border p-2 rounded-xl shadow-2xl select-none">
      <button
        onClick={() => onToolSelect('select')}
        className={clsx(
          "p-2 rounded-lg transition-all cursor-pointer",
          activeTool === 'select' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title="Select Tool"
      >
        <Icon icon="lucide:mouse-pointer" className="text-base" />
      </button>
      <button
        onClick={() => onToolSelect('pan')}
        className={clsx(
          "p-2 rounded-lg transition-all cursor-pointer",
          activeTool === 'pan' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title="Pan Tool"
      >
        <Icon icon="lucide:move" className="text-base" />
      </button>
      <button
        onClick={() => onToolSelect('link')}
        className={clsx(
          "p-2 rounded-lg transition-all cursor-pointer",
          activeTool === 'link' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title="Add Connection"
      >
        <Icon icon="lucide:link" className="text-base" />
      </button>
      <div className="w-[1px] h-6 bg-border"></div>
      <button
        onClick={onReset}
        className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all cursor-pointer"
        title="Reset View"
      >
        <Icon icon="lucide:refresh-cw" className="text-base" />
      </button>
    </div>
  );
};

// YAML Syntax Highlighting Function
function highlightYAMLCode(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let charIdx = 0;

    while (remaining.length > 0) {
      // Comments
      if (remaining.startsWith('#') || remaining.startsWith('---')) {
        parts.push(
          <span key={`${lineIdx}-${charIdx}`} className="text-emerald-500">
            {remaining}
          </span>
        );
        break;
      }

      // Dashes at line start
      if (remaining.match(/^(\s*)- /)) {
        const dashMatch = remaining.match(/^(\s*)- /);
        if (dashMatch) {
          const indent = dashMatch[1];
          parts.push(
            <span key={`${lineIdx}-${charIdx}`} className="text-slate-400">
              {indent}
              <span className="text-blue-400">-</span>
              {' '}
            </span>
          );
          charIdx += dashMatch[0].length;
          remaining = remaining.slice(dashMatch[0].length);
          continue;
        }
      }

      // YAML keys
      if (remaining.match(/^(\s*)[a-zA-Z_][a-zA-Z0-9_-]*\s*:/)) {
        const keyMatch = remaining.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/);
        if (keyMatch) {
          const indent = keyMatch[1];
          const key = keyMatch[2];
          parts.push(
            <span key={`${lineIdx}-${charIdx}`}>
              <span className="text-slate-400">{indent}</span>
              <span className="text-blue-300">{key}</span>
              <span className="text-slate-400">:</span>
            </span>
          );
          charIdx += keyMatch[0].length;
          remaining = remaining.slice(keyMatch[0].length);
          continue;
        }
      }

      // String values (quoted or variables in curly braces)
      if (remaining.match(/^(\s*)(["'])(.*?)\2/)) {
        const stringMatch = remaining.match(/^(\s*)(["'])(.*?)\2/);
        if (stringMatch) {
          const indent = stringMatch[1];
          const quote = stringMatch[2];
          const value = stringMatch[3];
          parts.push(
            <span key={`${lineIdx}-${charIdx}`}>
              <span className="text-slate-400">{indent}</span>
              <span className="text-orange-400">
                {quote}
                {value}
                {quote}
              </span>
            </span>
          );
          charIdx += stringMatch[0].length;
          remaining = remaining.slice(stringMatch[0].length);
          continue;
        }
      }

      // Booleans
      if (remaining.match(/^(\s*)(true|false|yes|no|on|off)(?:\s|$|#)/i)) {
        const boolMatch = remaining.match(/^(\s*)(true|false|yes|no|on|off)/i);
        if (boolMatch) {
          const indent = boolMatch[1];
          const bool = boolMatch[2];
          parts.push(
            <span key={`${lineIdx}-${charIdx}`}>
              <span className="text-slate-400">{indent}</span>
              <span className="text-purple-400">{bool}</span>
            </span>
          );
          charIdx += boolMatch[0].length;
          remaining = remaining.slice(boolMatch[0].length);
          continue;
        }
      }

      // Numbers
      if (remaining.match(/^(\s*)(\d+(\.\d+)?)/)) {
        const numMatch = remaining.match(/^(\s*)(\d+(\.\d+)?)/);
        if (numMatch) {
          const indent = numMatch[1];
          const num = numMatch[2];
          parts.push(
            <span key={`${lineIdx}-${charIdx}`}>
              <span className="text-slate-400">{indent}</span>
              <span className="text-green-400">{num}</span>
            </span>
          );
          charIdx += numMatch[0].length;
          remaining = remaining.slice(numMatch[0].length);
          continue;
        }
      }

      // Plain text
      const textMatch = remaining.match(/^[^:\n#]+/);
      if (textMatch) {
        parts.push(
          <span key={`${lineIdx}-${charIdx}`} className="text-slate-300">
            {textMatch[0]}
          </span>
        );
        charIdx += textMatch[0].length;
        remaining = remaining.slice(textMatch[0].length);
        continue;
      }

      // Fallback
      parts.push(
        <span key={`${lineIdx}-${charIdx}`} className="text-slate-300">
          {remaining[0]}
        </span>
      );
      charIdx += 1;
      remaining = remaining.slice(1);
    }

    return (
      <div key={lineIdx} className="min-h-[1.25rem]">
        {parts}
      </div>
    );
  });
}

// CodePreview (HCL/YAML) Component
interface CodePreviewProps {
  selectedNode: Node | null;
  ansiblePlaybook: string;
}

const CodePreview: React.FC<CodePreviewProps> = ({ selectedNode, ansiblePlaybook }) => {
  const [copied, setCopied] = useState(false);

  const isAnsibleNode = selectedNode?.data?.tech === 'Ansible';
  const isTerraformNode = selectedNode?.data?.tech === 'Terraform';

  const codeString = useMemo(() => {
    if (!selectedNode || isAnsibleNode) {
      return ansiblePlaybook;
    }

    // TODO: This Terraform security group code output is hardcoded/static. Replace this block with dynamic HCL generation based on the security group's inputs and parameter configuration.
    if (selectedNode.id.startsWith('aws_security_group')) {
      return `resource "aws_security_group" "web_sg" {
  name        = "web_sg"
  description = "Allows HTTP/HTTPS inbound & SSH access"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`;
    }

    if (selectedNode.id.startsWith('aws_instance.web_server')) {
      const p = selectedNode.data.parameters as any || {
        instanceName: 'web_server',
        amiId: 'ami-785db401', // LocalStack's mocked EC2 only recognizes its own seeded AMIs
        instanceType: 't3.medium',
        subnetId: 'subnet-0123456789abcdef0',
        rootVolumeSize: 50,
        tags: [{ key: 'Environment', value: 'prod' }, { key: 'Role', value: 'web' }]
      };

      return `resource "aws_instance" "${p.instanceName}" {
  ami           = "${p.amiId}"
  instance_type = "${p.instanceType}"
  subnet_id     = "${p.subnetId}"

  root_block_device {
    volume_size = ${p.rootVolumeSize}
  }

  tags = {
    ${p.tags.map((t: any) => `${t.key} = "${t.value}"`).join('\n    ')}
  }
}`;
    }

    // TODO: Fallback configuration output for other unmapped Terraform/Kubernetes nodes is static. Implement dedicated HCL/YAML generator templates for these nodes.
    return `# Configuration for ${selectedNode.id}`;
  }, [selectedNode, isAnsibleNode, ansiblePlaybook]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedBlock = useMemo(() => {
    if (!selectedNode || isAnsibleNode) {
      return highlightYAMLCode(codeString);
    }
    
    // Simulate Terraform syntax highlighting
    const lines = codeString.split('\n');
    return lines.map((line, idx) => {
      let rendered: React.ReactNode = line;
      if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
        rendered = <span className="text-emerald-500">{line}</span>;
      } else {
        const parts = line.split(/("[^"]*")/g);
        rendered = parts.map((part, pIdx) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return <span key={pIdx} className="text-orange-400">{part}</span>;
          }
          if (part.includes('resource ') || part.includes('provider ') || part.includes('ingress ') || part.includes('tags ')) {
            const sub = part.split(/(resource|provider|ingress|tags)/g);
            return sub.map((s, sIdx) => {
              if (['resource', 'provider', 'ingress', 'tags'].includes(s)) {
                return <span key={sIdx} className="text-purple-400">{s}</span>;
              }
              return s;
            });
          }
          return part;
        });
      }
      return <div key={idx} className="min-h-[1.25rem]">{rendered}</div>;
    });
  }, [codeString, selectedNode, isAnsibleNode]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-2 select-none">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {!selectedNode || isAnsibleNode ? 'Live Playbook Playbook' : 'Live HCL Output'}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-primary hover:text-primary/90 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <Icon icon={copied ? "lucide:check" : "lucide:copy"} className="text-xs" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 bg-[#080B11] border border-border rounded-lg p-3 overflow-auto font-mono text-[11px] text-muted-foreground leading-relaxed h-[calc(100%-24px)]">
        <pre className="whitespace-pre-wrap break-all">
          <code>{highlightedBlock}</code>
        </pre>
      </div>
    </div>
  );
};

// A sub-component to show all canvas components when no node is active
const CanvasSummary: React.FC<{
  nodes: Node[];
  onSelectNode: (id: string) => void;
}> = ({ nodes, onSelectNode }) => {
  const srcNodes = nodes.filter((n) => n.data?.tech === 'Source');
  const targetNodes = nodes.filter((n) => n.data?.tech === 'Target');
  const tfNodes = nodes.filter((n) => n.data?.tech === 'Terraform');
  const ansNodes = nodes.filter((n) => n.data?.tech === 'Ansible');
  const k8sNodes = nodes.filter((n) => n.data?.tech === 'Kubernetes');

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="border-b border-border/80 pb-2">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Canvas Summary</h4>
        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
          Select any active block below to edit its configurations.
        </p>
      </div>

      <div className="space-y-4">
        {srcNodes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706] animate-pulse"></span>
              Source ({srcNodes.length})
            </h5>
            <div className="grid gap-1.5">
              {srcNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/70 border border-border/60 hover:border-[#D97706]/40 rounded-lg p-2.5 flex items-center justify-between text-xs text-foreground transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-semibold truncate max-w-[200px] flex items-center gap-2">
                    <Icon icon={node.data.icon as string} className="text-[#D97706] text-sm flex-shrink-0" />
                    {node.data.label as string}
                  </span>
                  <Icon icon="lucide:chevron-right" className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all text-xs" />
                </button>
              ))}
            </div>
          </div>
        )}

        {targetNodes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-[#0D9488] uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488] animate-pulse"></span>
              Target ({targetNodes.length})
            </h5>
            <div className="grid gap-1.5">
              {targetNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/70 border border-border/60 hover:border-[#0D9488]/40 rounded-lg p-2.5 flex items-center justify-between text-xs text-foreground transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-semibold truncate max-w-[200px] flex items-center gap-2">
                    <Icon icon={node.data.icon as string} className="text-[#0D9488] text-sm flex-shrink-0" />
                    {node.data.label as string}
                  </span>
                  <Icon icon="lucide:chevron-right" className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all text-xs" />
                </button>
              ))}
            </div>
          </div>
        )}

        {tfNodes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
              Terraform ({tfNodes.length})
            </h5>
            <div className="grid gap-1.5">
              {tfNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/70 border border-border/60 hover:border-primary/40 rounded-lg p-2.5 flex items-center justify-between text-xs text-foreground transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-semibold truncate max-w-[200px] flex items-center gap-2">
                    <Icon icon={node.data.icon as string} className="text-primary text-sm flex-shrink-0" />
                    {node.id}
                  </span>
                  <Icon icon="lucide:chevron-right" className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all text-xs" />
                </button>
              ))}
            </div>
          </div>
        )}

        {ansNodes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-[#00A4FF] uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00A4FF] animate-pulse"></span>
              Ansible ({ansNodes.length})
            </h5>
            <div className="grid gap-1.5">
              {ansNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/70 border border-border/60 hover:border-[#00A4FF]/40 rounded-lg p-2.5 flex items-center justify-between text-xs text-foreground transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-semibold truncate max-w-[200px] flex items-center gap-2">
                    <Icon icon={node.data.icon as string} className="text-[#00A4FF] text-sm flex-shrink-0" />
                    {node.data.label as string}
                  </span>
                  <Icon icon="lucide:chevron-right" className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all text-xs" />
                </button>
              ))}
            </div>
          </div>
        )}

        {k8sNodes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-[#326CE5] uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#326CE5] animate-pulse"></span>
              Kubernetes ({k8sNodes.length})
            </h5>
            <div className="grid gap-1.5">
              {k8sNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/70 border border-border/60 hover:border-[#326CE5]/40 rounded-lg p-2.5 flex items-center justify-between text-xs text-foreground transition-all duration-200 group cursor-pointer"
                >
                  <span className="font-semibold truncate max-w-[200px] flex items-center gap-2">
                    <Icon icon={node.data.icon as string} className="text-[#326CE5] text-sm flex-shrink-0" />
                    {node.data.label as string}
                  </span>
                  <Icon icon="lucide:chevron-right" className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all text-xs" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// InspectorPanel Component
interface InspectorPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedNode: Node | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  updateNodeData: (nodeId: string, newData: any) => void;
  ansiblePlaybook: string;
  nodes: Node[];
  setSelectedNodeId: (id: string | null) => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  collapsed,
  onToggle,
  selectedNode,
  activeTab,
  onTabChange,
  updateNodeData,
  ansiblePlaybook,
  nodes,
  setSelectedNodeId,
}) => {
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagVal, setNewTagVal] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  const p = (selectedNode?.data?.parameters as any) || DEFAULT_INSTANCE_PARAMS;

  const handleParameterChange = (key: string, value: any) => {
    if (!selectedNode) return;
    updateNodeData(selectedNode.id, {
      parameters: {
        ...p,
        [key]: value
      }
    });
  };

  const handleTagAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagKey && newTagVal && selectedNode) {
      updateNodeData(selectedNode.id, {
        parameters: {
          ...p,
          tags: [...p.tags, { key: newTagKey, value: newTagVal }]
        }
      });
      setNewTagKey('');
      setNewTagVal('');
      setShowAddTag(false);
    }
  };

  const handleTagDelete = (index: number) => {
    if (!selectedNode) return;
    updateNodeData(selectedNode.id, {
      parameters: {
        ...p,
        tags: p.tags.filter((_: any, idx: number) => idx !== index)
      }
    });
  };

  // Node variable inputs for Ansible nodes
  const nodeLabel = selectedNode?.data?.label as string || '';
  const portVal = (selectedNode?.data?.port as string) || '';
  const dbUserVal = (selectedNode?.data?.dbUser as string) || '';
  const dbPassVal = (selectedNode?.data?.dbPass as string) || '';
  const repoUrlVal = (selectedNode?.data?.repoUrl as string) || '';
  const branchVal = (selectedNode?.data?.branch as string) || '';
  const environmentVal = (selectedNode?.data?.environment as string) || 'localstack';
  const regionVal = (selectedNode?.data?.region as string) || 'us-east-1';
  const startCommandVal = (selectedNode?.data?.startCommand as string) || '';
  const appPortVal = (selectedNode?.data?.appPort as string) || '';

  return (
    <aside className={clsx(
      "bg-card/95 backdrop-blur-md flex flex-col shrink-0 z-20 transition-all duration-300 relative overflow-visible",
      collapsed ? "w-0 border-l-0" : "w-90 border-l border-border"
    )}>
      {/* Sliding Window Container */}
      <div className="w-full h-full overflow-hidden">
        {/* Fixed Width Content Panel */}
        <div className="w-90 h-full flex flex-col">
          {/* Inspector Header */}
          <div className="p-4 border-b border-border flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon
                  icon={(selectedNode?.data?.icon as string) || "lucide:globe"}
                  className={clsx("text-sm", (selectedNode?.data?.tech as string) === 'Terraform' ? 'text-primary' : (selectedNode?.data?.tech as string) === 'Ansible' ? 'text-[#00A4FF]' : (selectedNode?.data?.tech as string) === 'Source' ? 'text-[#D97706]' : (selectedNode?.data?.tech as string) === 'Target' ? 'text-[#0D9488]' : 'text-[#326CE5]')}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground truncate max-w-[150px]">{selectedNode?.id || "No Selection"}</h3>
                <p className="text-[10px] text-muted-foreground">{(selectedNode?.data?.tech as string) || 'Global'} Configuration</p>
              </div>
            </div>
            <button onClick={onToggle} className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-all cursor-pointer" title="Close Inspector">
              <Icon icon="lucide:x" className="text-sm" />
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-border select-none">
            <button
              onClick={() => onTabChange('Parameters')}
              className={clsx(
                "flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer",
                activeTab === 'Parameters' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Parameters
            </button>
            <button
              onClick={() => onTabChange('Live Code Preview')}
              className={clsx(
                "flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-all cursor-pointer",
                activeTab === 'Live Code Preview' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Live Code Preview
            </button>
          </div>

          {/* Tab Content */}
          <div className={clsx("flex-1 p-4", activeTab === 'Parameters' ? "overflow-y-auto space-y-4" : "flex flex-col overflow-hidden")}>
            {activeTab === 'Parameters' ? (
              !selectedNode ? (
                nodes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs select-none animate-in fade-in duration-200">
                    <div className="text-2xl mb-2">📋</div>
                    <p className="font-semibold text-white text-sm">Canvas is empty</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal max-w-[200px] mx-auto">
                      Add automation components to the canvas to configure parameters.
                    </p>
                  </div>
                ) : (
                  <CanvasSummary nodes={nodes} onSelectNode={setSelectedNodeId} />
                )
              ) : (
                <div className="space-y-3">
                  {/* 1. TERRAFORM INSTANCE NODE PARAMETERS */}
                  {selectedNode.id.startsWith('aws_instance.web_server') && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Instance Name</label>
                        <input
                          type="text"
                          value={p.instanceName}
                          onChange={(e) => handleParameterChange('instanceName', e.target.value)}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AMI ID</label>
                          <input
                            type="text"
                            value={p.amiId}
                            onChange={(e) => handleParameterChange('amiId', e.target.value)}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Instance Type</label>
                          <div className="relative">
                            <select
                              value={p.instanceType}
                              onChange={(e) => handleParameterChange('instanceType', e.target.value)}
                              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                            >
                              <option value="t3.micro">t3.micro</option>
                              <option value="t3.small">t3.small</option>
                              <option value="t3.medium">t3.medium</option>
                              <option value="t3.large">t3.large</option>
                              <option value="m5.large">m5.large</option>
                              <option value="m5.xlarge">m5.xlarge</option>
                              <option value="c5.large">c5.large</option>
                            </select>
                            <Icon icon="lucide:chevron-down" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">VPC Subnet ID</label>
                        <input
                          type="text"
                          value={p.subnetId}
                          onChange={(e) => handleParameterChange('subnetId', e.target.value)}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1 select-none">
                          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Root Volume Size</label>
                          <span className="text-xs font-semibold text-foreground">{p.rootVolumeSize} GB</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="200"
                          value={p.rootVolumeSize}
                          onChange={(e) => handleParameterChange('rootVolumeSize', parseInt(e.target.value))}
                          className="w-full accent-primary bg-muted h-1 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 select-none">
                          <span>8 GB</span>
                          <span>200 GB</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tags</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-muted border border-border rounded-lg">
                          {p.tags.map((tag: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1 bg-card px-2 py-0.5 rounded text-[10px] text-foreground border border-border">
                              {tag.key}: {tag.value}
                              <button onClick={() => handleTagDelete(idx)} className="text-muted-foreground hover:text-red-400 transition-colors cursor-pointer">
                                <Icon icon="lucide:x" className="text-[10px]" />
                              </button>
                            </span>
                          ))}
                          {!showAddTag ? (
                            <button
                              onClick={() => setShowAddTag(true)}
                              className="text-[10px] text-primary hover:text-primary/90 font-semibold px-2 py-0.5 flex items-center gap-1 cursor-pointer"
                            >
                              <Icon icon="lucide:plus" className="text-xs" /> Add tag
                            </button>
                          ) : (
                            <form onSubmit={handleTagAdd} className="flex items-center gap-1 w-full mt-1">
                              <input
                                type="text"
                                placeholder="Key"
                                value={newTagKey}
                                onChange={(e) => setNewTagKey(e.target.value)}
                                className="bg-card border border-border rounded px-1.5 py-0.5 text-[10px] w-1/2 text-foreground focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="Value"
                                value={newTagVal}
                                onChange={(e) => setNewTagVal(e.target.value)}
                                className="bg-card border border-border rounded px-1.5 py-0.5 text-[10px] w-1/2 text-foreground focus:outline-none"
                              />
                              <button type="submit" className="text-emerald-400 hover:text-emerald-300 cursor-pointer">
                                <Icon icon="lucide:check" className="text-xs" />
                              </button>
                              <button type="button" onClick={() => setShowAddTag(false)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                                <Icon icon="lucide:x" className="text-xs" />
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 2. ANSIBLE DYNAMIC NODE PARAMETERS (VARIABLES) */}
                  {selectedNode.data.tech === 'Ansible' && (
                    <div className="space-y-4">
                      <p className="text-[11px] text-muted-foreground">Ansible playbooks support variable binding using `{`{ variable }`}`. Click `{`{x}`}` to convert hardcoded values to variables.</p>
                      
                      {nodeLabel.includes('Open Port') && (
                        <div>
                          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Open Firewall Port</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={portVal}
                              onChange={(e) => updateNodeData(selectedNode.id, { port: e.target.value })}
                              placeholder="e.g. 80 or {{ port }}"
                              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                            />
                            <button
                              onClick={() => {
                                const current = portVal || 'port_number';
                                if (!current.startsWith('{{')) {
                                  updateNodeData(selectedNode.id, { port: `{{ ${current} }}` });
                                }
                              }}
                              className="px-3 bg-muted border border-border rounded-lg text-muted-foreground hover:text-primary transition-all font-mono text-xs cursor-pointer flex items-center justify-center"
                              title="Convert to Variable"
                            >
                              {'{x}'}
                            </button>
                          </div>
                        </div>
                      )}

                      {(nodeLabel.includes('PostgreSQL') || nodeLabel.includes('Postgres')) && (
                        <>
                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Database User</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={dbUserVal}
                                onChange={(e) => updateNodeData(selectedNode.id, { dbUser: e.target.value })}
                                placeholder="e.g. admin or {{ db_user }}"
                                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                              />
                              <button
                                onClick={() => {
                                  const current = dbUserVal || 'db_user';
                                  if (!current.startsWith('{{')) {
                                    updateNodeData(selectedNode.id, { dbUser: `{{ ${current} }}` });
                                  }
                                }}
                                className="px-3 bg-muted border border-border rounded-lg text-muted-foreground hover:text-primary transition-all font-mono text-xs cursor-pointer flex items-center justify-center"
                                title="Convert to Variable"
                              >
                                {'{x}'}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Database Password</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={dbPassVal}
                                onChange={(e) => updateNodeData(selectedNode.id, { dbPass: e.target.value })}
                                placeholder="e.g. password or {{ db_pass }}"
                                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono"
                              />
                              <button
                                onClick={() => {
                                  const current = dbPassVal || 'db_pass';
                                  if (!current.startsWith('{{')) {
                                    updateNodeData(selectedNode.id, { dbPass: `{{ ${current} }}` });
                                  }
                                }}
                                className="px-3 bg-muted border border-border rounded-lg text-muted-foreground hover:text-primary transition-all font-mono text-xs cursor-pointer flex items-center justify-center"
                                title="Convert to Variable"
                              >
                                {'{x}'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {nodeLabel.includes('Deploy Node App') && (
                        <div className="space-y-4">
                          <p className="text-[11px] text-muted-foreground">
                            Requires a Code Repository node connected upstream — this task copies its cloned code onto the server, installs dependencies, and keeps it running with pm2.
                          </p>
                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Start Command</label>
                            <input
                              type="text"
                              value={startCommandVal}
                              onChange={(e) => updateNodeData(selectedNode.id, { startCommand: e.target.value })}
                              placeholder="npm start"
                              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">App Port</label>
                            <input
                              type="text"
                              value={appPortVal}
                              onChange={(e) => updateNodeData(selectedNode.id, { appPort: e.target.value })}
                              placeholder="3000"
                              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {!nodeLabel.includes('Open Port') && !nodeLabel.includes('Postgres') && !nodeLabel.includes('PostgreSQL') && !nodeLabel.includes('Deploy Node App') && (
                        <div className="text-center py-6 text-muted-foreground text-xs select-none">
                          No custom variables to configure for this Ansible block.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2b. SOURCE / CODE REPOSITORY NODE PARAMETERS */}
                  {selectedNode.data.tech === 'Source' && (
                    <div className="space-y-4">
                      <p className="text-[11px] text-muted-foreground">
                        The pipeline clones this repository onto the target server before the configuration steps run.
                      </p>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Repository URL</label>
                        <input
                          type="text"
                          value={repoUrlVal}
                          onChange={(e) => updateNodeData(selectedNode.id, { repoUrl: e.target.value })}
                          placeholder="https://github.com/your-org/your-app.git"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Branch</label>
                        <input
                          type="text"
                          value={branchVal}
                          onChange={(e) => updateNodeData(selectedNode.id, { branch: e.target.value })}
                          placeholder="main"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* 2c. AWS TARGET NODE PARAMETERS */}
                  {selectedNode.data.tech === 'Target' && (
                    <div className="space-y-4">
                      <p className="text-[11px] text-muted-foreground">
                        Chooses which AWS environment Terraform provisions into. Only the LocalStack sandbox is wired up right now.
                      </p>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Environment</label>
                        <div className="relative">
                          <select
                            value={environmentVal}
                            onChange={(e) => updateNodeData(selectedNode.id, { environment: e.target.value })}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                          >
                            <option value="localstack">LocalStack (Sandbox)</option>
                            <option value="aws" disabled>Real AWS — coming later</option>
                          </select>
                          <Icon icon="lucide:chevron-down" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">AWS Region</label>
                        <input
                          type="text"
                          value={regionVal}
                          onChange={(e) => updateNodeData(selectedNode.id, { region: e.target.value })}
                          placeholder="us-east-1"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. STATIC / MOCK NODES */}
                  {selectedNode.data.tech !== 'Ansible' && selectedNode.data.tech !== 'Source' && selectedNode.data.tech !== 'Target' && !selectedNode.id.startsWith('aws_instance.web_server') && (
                    <div className="text-center py-6 text-muted-foreground text-xs select-none">
                      No custom parameters defined for this mock infrastructure block.
                    </div>
                  )}
                </div>
              )
            ) : (
              <CodePreview selectedNode={selectedNode} ansiblePlaybook={ansiblePlaybook} />
            )}
          </div>
        </div>
      </div>

      {/* Collapse Trigger Button */}
      <button
        onClick={onToggle}
        className="absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md hover:shadow-primary/10 transition-all z-30 cursor-pointer"
        title="Toggle Inspector Panel"
      >
        <Icon icon={collapsed ? "lucide:arrow-left" : "lucide:arrow-right"} className="text-xs" />
      </button>
    </aside>
  );
};

// --- MOCK LIBRARY DATA ---
const LIBRARY_NODES: LibraryNode[] = [
  {
    id: 'code_repository',
    tech: 'Source',
    icon: 'lucide:git-branch',
    title: 'Code Repository',
    description: "Your app's source code. The pipeline clones this repo onto the target server before deployment.",
    category: 'Source Code'
  },
  {
    id: 'aws_target',
    tech: 'Target',
    icon: 'lucide:cloud',
    title: 'AWS Target',
    description: 'Chooses where this pipeline deploys — LocalStack sandbox for testing, real AWS later.',
    category: 'Cloud Target'
  },
  {
    id: 'aws_instance.web_server',
    tech: 'Terraform',
    icon: 'lucide:globe',
    title: 'aws_instance.web_server',
    description: 'Provisions a high-performance EC2 web server instance with security groups.',
    category: 'Provisioning & Cloud'
  },
  {
    id: 'aws_security_group',
    tech: 'Terraform',
    icon: 'lucide:shield',
    title: 'aws_security_group',
    description: 'Configures stateful firewall rules to allow inbound HTTP/HTTPS traffic.',
    category: 'Provisioning & Cloud'
  },
  {
    id: 'update-packages',
    tech: 'Ansible',
    icon: 'lucide:package',
    title: 'Update Packages',
    description: 'Updates package repositories and upgrades system modules.',
    category: 'Configuration & Setup'
  },
  {
    id: 'nginx',
    tech: 'Ansible',
    icon: 'lucide:globe',
    title: 'Install Nginx',
    description: 'Installs and configures the latest stable Nginx web server.',
    category: 'Configuration & Setup'
  },
  {
    id: 'nodejs',
    tech: 'Ansible',
    icon: 'lucide:terminal',
    title: 'Install Node.js',
    description: 'Installs Node.js packages and npm environment.',
    category: 'Configuration & Setup'
  },
  {
    id: 'postgresql',
    tech: 'Ansible',
    icon: 'lucide:database',
    title: 'PostgreSQL',
    description: 'Installs PostgreSQL database and creates deployment schema.',
    category: 'Configuration & Setup'
  },
  {
    id: 'open-port',
    tech: 'Ansible',
    icon: 'lucide:unlock',
    title: 'Open Port',
    description: 'Opens a selected networking port in local host firewalls.',
    category: 'Configuration & Setup'
  },
  {
    id: 'copy-env',
    tech: 'Ansible',
    icon: 'lucide:file-text',
    title: 'Copy .env File',
    description: 'Synchronizes environment local configurations onto remote hosts.',
    category: 'Configuration & Setup'
  },
  {
    id: 'deploy-node-app',
    tech: 'Ansible',
    icon: 'lucide:rocket',
    title: 'Deploy Node App',
    description: 'Copies the connected repo onto the server, runs npm install, and starts it with pm2.',
    category: 'Configuration & Setup'
  },
  {
    id: 'k8s_pod_deployment',
    tech: 'Kubernetes',
    icon: 'lucide:layers',
    title: 'k8s_pod_deployment',
    description: 'Configures a scalable deployment with rolling updates and resource limits.',
    category: 'Container Deployment'
  }
];

// --- FLOW EDITOR AREA CANVAS ---
function WorkspaceCanvas() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect, 
    addNode, 
    selectedNodeId, 
    setSelectedNodeId 
  } = useCanvasStore();
  
  const { screenToFlowPosition, fitView } = useReactFlow();

  const nodeTypes = useMemo(() => ({ customNode: ReactFlowCanvasNode }), []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const id = event.dataTransfer.getData('application/reactflow-node-id');
    if (!id) return;

    const tech = event.dataTransfer.getData('application/reactflow-node-tech');
    const icon = event.dataTransfer.getData('application/reactflow-node-icon');
    const title = event.dataTransfer.getData('application/reactflow-node-title');
    const description = event.dataTransfer.getData('application/reactflow-node-description');
    const category = event.dataTransfer.getData('application/reactflow-node-category');

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNodeId = `${id}_${Date.now().toString().slice(-4)}`;

    const newNode: Node = {
      id: newNodeId,
      type: 'customNode',
      position,
      data: {
        label: title,
        tech: tech as any,
        icon,
        categoryLabel: tech === 'Terraform' ? 'AWS Resource' : tech === 'Ansible' ? 'Ansible Task' : tech === 'Source' ? 'Source Code' : tech === 'Target' ? 'Cloud Target' : 'K8s Resource',
        description,
        status: 'Validated',
        statusText: 'Validated',
      },
    };

    if (id === 'aws_instance.web_server') {
      newNode.data.parameters = { ...DEFAULT_INSTANCE_PARAMS };
    }
    if (id === 'aws_security_group') {
      newNode.data.parameters = { ...DEFAULT_SG_PARAMS };
    }

    addNode(newNode);
    setSelectedNodeId(newNodeId);
  }, [screenToFlowPosition, addNode, setSelectedNodeId]);

  return (
    <div 
      className="flex-grow h-full relative" 
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background color="#242F41" gap={24} size={1} />
        <Controls showInteractive={false} className="!bg-card !border-border !text-foreground" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-6 select-none animate-in fade-in zoom-in duration-300">
          <div className="max-w-md w-full bg-slate-900/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
              <Icon icon="lucide:layers" className="text-white text-2xl animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Design Your Infrastructure Canvas</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Drag and drop cloud resources or configuration modules from the library panel on the left to begin provisioning (Terraform), configuring (Ansible), or deploying containers (Kubernetes).
              </p>
            </div>
            <div className="flex items-center gap-6 mt-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Icon icon="lucide:code" className="text-primary text-xs" /> Terraform</span>
              <span className="flex items-center gap-1.5"><Icon icon="lucide:zap" className="text-[#00A4FF] text-xs" /> Ansible</span>
              <span className="flex items-center gap-1.5"><Icon icon="lucide:layers" className="text-[#326CE5] text-xs" /> Kubernetes</span>
            </div>
          </div>
        </div>
      )}

      {/* SVG linear gradients definitions for connections */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="grad-tf-ansible" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#844FBA" />
            <stop offset="100%" stopColor="#00A4FF" />
          </linearGradient>
          <linearGradient id="grad-ansible-k8s" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00A4FF" />
            <stop offset="100%" stopColor="#326CE5" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// --- WORKSPACE LAYOUT WRAPPER ---
function WorkspaceContent() {
  const router = useRouter();
  const { nodes, edges, selectedNodeId, updateNodeData, resetCanvas, setSelectedNodeId } = useCanvasStore();
  const { zoomIn, zoomOut, setViewport, getZoom } = useReactFlow();

  const [selectedProject] = useState("Web-Server-Orchestration");
  const [selectedOS, setSelectedOS] = useState("Linux");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [techFilter, setTechFilter] = useState("All");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("Parameters");
  const [canvasTool, setCanvasTool] = useState("select");

  const [deployStatus, setDeployStatus] = useState<"IDLE" | "PENDING" | "RUNNING" | "SUCCESS" | "FAILED">("IDLE");
  const [logs, setLogs] = useState("");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [autoDestroy, setAutoDestroy] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal when logs change
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Clean up websocket connection on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleDeployClick = async () => {
    if (nodes.length === 0) {
      alert("⚠️ Cannot deploy: Canvas is empty.");
      return;
    }

    setDeployStatus("PENDING");
    setLogs("[CLIENT] Compiling canvas files and preparing payload...\n");
    setIsTerminalOpen(true);
    setActiveRunId(null);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Compile files on the client side (Approach A)
      const compiledFiles = generateBundleFiles(nodes, edges);

      // Make post request to Go backend
      const response = await fetch("http://localhost:8080/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          canvas: { nodes, edges },
          files: compiledFiles.map(f => ({ path: f.path, content: f.content })),
          autoDestroy: autoDestroy
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to deploy. HTTP status: ${response.status}`);
      }

      const data = await response.json();
      const runId = data.runId;
      setActiveRunId(runId);
      setDeployStatus(data.status);
      setLogs(prev => prev + `[CLIENT] Deployment registered with runID: ${runId}\n[CLIENT] Establishing log streaming WebSocket connection...\n`);

      // Connect to WebSocket endpoint
      const wsUrl = `ws://localhost:8080/api/ws/runs/${runId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLogs(prev => prev + "[CLIENT] WebSocket connection established. Streaming pipeline runner logs...\n");
      };

      ws.onmessage = (event) => {
        try {
          const wsData = JSON.parse(event.data);
          if (wsData.type === "status_change") {
            setDeployStatus(wsData.status);
          } else if (wsData.type === "log") {
            setLogs(prev => prev + wsData.message);
          }
        } catch (e) {
          // Fallback if message is raw text
          setLogs(prev => prev + event.data);
        }
      };

      ws.onerror = (err) => {
        setLogs(prev => prev + `\n[CLIENT] WebSocket encountered an error.\n`);
        console.error("WS error:", err);
      };

      ws.onclose = (event) => {
        setLogs(prev => prev + `\n[CLIENT] Log stream closed (code: ${event.code}).\n`);
      };

    } catch (err: any) {
      setDeployStatus("FAILED");
      setLogs(prev => prev + `\n[CLIENT_ERROR] Failed to execute deployment: ${err.message || err}\n`);
    }
  };

  const handleDestroyClick = async () => {
    setDeployStatus("PENDING");
    setLogs("[CLIENT] Triggering infrastructure tear-down (terraform destroy)...\n");
    setIsTerminalOpen(true);
    setActiveRunId(null);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Make destroy request to Go backend
      const response = await fetch("http://localhost:8080/api/destroy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          canvas: { nodes, edges }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger destroy. HTTP status: ${response.status}`);
      }

      const data = await response.json();
      const runId = data.runId;
      setActiveRunId(runId);
      setDeployStatus(data.status);
      setLogs(prev => prev + `[CLIENT] Destroy run registered with runID: ${runId}\n[CLIENT] Establishing log streaming WebSocket connection...\n`);

      // Connect to WebSocket endpoint
      const wsUrl = `ws://localhost:8080/api/ws/runs/${runId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLogs(prev => prev + "[CLIENT] WebSocket connection established. Streaming execution logs...\n");
      };

      ws.onmessage = (event) => {
        try {
          const wsData = JSON.parse(event.data);
          if (wsData.type === "status_change") {
            setDeployStatus(wsData.status);
          } else if (wsData.type === "log") {
            setLogs(prev => prev + wsData.message);
          }
        } catch (e) {
          setLogs(prev => prev + event.data);
        }
      };

      ws.onerror = (err) => {
        setLogs(prev => prev + `\n[CLIENT] WebSocket encountered an error.\n`);
        console.error("WS error:", err);
      };

      ws.onclose = (event) => {
        setLogs(prev => prev + `\n[CLIENT] Log stream closed (code: ${event.code}).\n`);
      };

    } catch (err: any) {
      setDeployStatus("FAILED");
      setLogs(prev => prev + `\n[CLIENT_ERROR] Failed to execute destroy: ${err.message || err}\n`);
    }
  };

  // Keep zoom level in header synced with React Flow viewport
  useEffect(() => {
    const checkZoom = setInterval(() => {
      try {
        const currentZoom = getZoom();
        if (currentZoom) {
          setZoomLevel(Math.round(currentZoom * 100));
        }
      } catch (e) {}
    }, 500);

    return () => clearInterval(checkZoom);
  }, [getZoom]);

  const handleOSChange = (os: string) => {
    setSelectedOS(os);
  };

  const handleZoomInClick = () => {
    zoomIn();
  };

  const handleZoomOutClick = () => {
    zoomOut();
  };

  const handleZoomResetClick = () => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
    setZoomLevel(100);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleTechFilterSelect = (tech: string) => {
    setTechFilter(tech);
  };

  const toggleLeftPanel = () => {
    setLeftPanelCollapsed(!leftPanelCollapsed);
  };

  const toggleRightPanel = () => {
    setRightPanelCollapsed(!rightPanelCollapsed);
  };

  const handleInspectorTabChange = (tab: string) => {
    setInspectorTab(tab);
  };

  const handleCanvasToolSelect = (tool: string) => {
    setCanvasTool(tool);
  };

  const handleAddNodeToCanvas = (libNode: LibraryNode) => {
    const newId = `${libNode.id}_${Date.now().toString().slice(-4)}`;
    
    // Position formula to avoid complete overlap
    const position = {
      x: 350 + (nodes.length * 30) % 250,
      y: 150 + (nodes.length * 30) % 250,
    };

    const newNode: Node = {
      id: newId,
      type: 'customNode',
      position,
      data: {
        label: libNode.title,
        tech: libNode.tech,
        icon: libNode.icon,
        categoryLabel: libNode.tech === 'Terraform' ? 'AWS Resource' : libNode.tech === 'Ansible' ? 'Ansible Task' : libNode.tech === 'Source' ? 'Source Code' : libNode.tech === 'Target' ? 'Cloud Target' : 'K8s Resource',
        description: libNode.description,
        status: 'Validated',
        statusText: 'Validated',
      },
    };

    if (libNode.id === 'aws_instance.web_server') {
      newNode.data.parameters = { ...DEFAULT_INSTANCE_PARAMS };
    }
    if (libNode.id === 'aws_security_group') {
      newNode.data.parameters = { ...DEFAULT_SG_PARAMS };
    }

    // Call store action
    useCanvasStore.getState().addNode(newNode);
    useCanvasStore.getState().setSelectedNodeId(newId);
  };

  // Compile playbook YAML from current canvas nodes
  const ansiblePlaybook = useMemo(() => generateAnsibleYAML(nodes, edges), [nodes, edges]);

  // Navigate to export-code page
  const handleExportClick = () => {
    router.push('/export-code');
  };

  // Handle specific format downloads
  const handleExportFormat = async (format: string) => {
    if (format === 'zip') {
      await downloadZipBundle(nodes, edges);
    } else if (format === 'yml') {
      const blob = new Blob([ansiblePlaybook], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playbook.yml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'tf') {
      // Find dynamic parameters
      const instanceNode = nodes.find(n => n.id === 'aws_instance.web_server');
      const p = instanceNode?.data?.parameters as any || {
        instanceName: 'web_server',
        amiId: 'ami-785db401', // LocalStack's mocked EC2 only recognizes its own seeded AMIs
        instanceType: 't3.medium',
        subnetId: 'subnet-0123456789abcdef0',
        rootVolumeSize: 50,
        tags: [{ key: 'Environment', value: 'prod' }, { key: 'Role', value: 'web' }]
      };
      
      const tfContent = `# Generated Terraform file
resource "aws_instance" "${p.instanceName}" {
  ami           = "${p.amiId}"
  instance_type = "${p.instanceType}"
  subnet_id     = "${p.subnetId}"
}`;
      const blob = new Blob([tfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'main.tf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'json') {
      const k8sContent = {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name: "web-server" }
      };
      const blob = new Blob([JSON.stringify(k8sContent, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'deployment.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <Header
        selectedProject={selectedProject}
        selectedOS={selectedOS}
        onOSChange={handleOSChange}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomInClick}
        onZoomOut={handleZoomOutClick}
        onZoomReset={handleZoomResetClick}
        onExport={handleExportClick}
        onExportFormat={handleExportFormat}
        onDeploy={handleDeployClick}
        deployStatus={deployStatus}
        isTerminalOpen={isTerminalOpen}
        onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
        autoDestroy={autoDestroy}
        onAutoDestroyChange={setAutoDestroy}
        onDestroy={handleDestroyClick}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <LibraryPanel
          collapsed={leftPanelCollapsed}
          onToggle={toggleLeftPanel}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          techFilter={techFilter}
          onTechFilterSelect={handleTechFilterSelect}
          libraryNodes={LIBRARY_NODES}
          onAddNode={handleAddNodeToCanvas}
        />

        <main className="flex-1 bg-background relative overflow-hidden flex flex-col">
          <WorkspaceCanvas />

          <CanvasControls
            activeTool={canvasTool}
            onToolSelect={handleCanvasToolSelect}
            onReset={resetCanvas}
          />

          {/* Terminal Drawer */}
          {isTerminalOpen && (
            <div className="absolute bottom-0 left-0 w-full h-72 bg-[#05080E]/95 border-t border-border z-30 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
              {/* Terminal Header */}
              <div className="h-10 px-4 border-b border-border bg-[#0C121D]/90 flex items-center justify-between select-none">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon icon="lucide:terminal" className="text-primary text-xs" />
                    Runner Output Log
                  </span>
                  {deployStatus !== 'IDLE' && (
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold border",
                      deployStatus === 'PENDING' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      deployStatus === 'RUNNING' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                      deployStatus === 'SUCCESS' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      deployStatus === 'FAILED' && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {deployStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setLogs("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 cursor-pointer"
                    title="Clear Log"
                  >
                    <Icon icon="lucide:trash-2" className="text-xs" />
                    Clear
                  </button>
                  <button
                    onClick={() => setIsTerminalOpen(false)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-all cursor-pointer"
                    title="Close Panel"
                  >
                    <Icon icon="lucide:x" className="text-xs" />
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto select-text scrollbar-thin">
                <pre className="whitespace-pre-wrap break-all pr-4">
                  {logs || "No active pipeline logs. Press \"Deploy\" to run visual orchestration..."}
                </pre>
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}
        </main>

        <InspectorPanel
          collapsed={rightPanelCollapsed}
          onToggle={toggleRightPanel}
          selectedNode={selectedNode}
          activeTab={inspectorTab}
          onTabChange={handleInspectorTabChange}
          updateNodeData={updateNodeData}
          ansiblePlaybook={ansiblePlaybook}
          nodes={nodes}
          setSelectedNodeId={setSelectedNodeId}
        />
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col relative font-sans overflow-hidden">
      <ReactFlowProvider>
        <WorkspaceContent />
      </ReactFlowProvider>
    </div>
  );
}
