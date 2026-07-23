'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { clsx } from 'clsx';

import useCanvasStore from '../store/useCanvasStore';
import { generateBundleFiles, downloadZipBundle, FileItem } from '../lib/bundleGenerator';

// --- SUB-COMPONENTS ---

interface DirectoryTreeProps {
  selectedFile: string;
  onFileSelect: (path: string) => void;
  files: FileItem[];
}

const FOLDER_META: Record<string, { label: string; color: string; icon: string }> = {
  terraform: { label: 'terraform/', color: 'text-primary', icon: 'lucide:folder' },
  ansible:   { label: 'ansible/',   color: 'text-[#00A4FF]', icon: 'lucide:folder' },
  k8s:       { label: 'k8s/',       color: 'text-[#326CE5]', icon: 'lucide:folder' },
};

const DirectoryTree: React.FC<DirectoryTreeProps> = ({ selectedFile, onFileSelect, files }) => {
  // Group files by their top-level directory (or root for README.md)
  const folders = useMemo(() => {
    const map: Record<string, FileItem[]> = {};
    for (const f of files) {
      const slash = f.path.indexOf('/');
      const dir = slash === -1 ? '__root__' : f.path.slice(0, slash);
      if (!map[dir]) map[dir] = [];
      map[dir].push(f);
    }
    return map;
  }, [files]);

  const renderFileBtn = (file: FileItem) => {
    const isSelected = selectedFile === file.path;
    return (
      <button
        key={file.path}
        onClick={() => onFileSelect(file.path)}
        className={clsx(
          'w-full flex items-center gap-2 py-1 px-2 rounded text-left transition-all cursor-pointer',
          isSelected
            ? 'text-primary font-semibold bg-primary/10 border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Icon icon={file.icon} className={clsx(isSelected ? 'text-primary' : file.iconColor || 'text-muted-foreground', 'text-xs')} />
        <span>{file.name}</span>
      </button>
    );
  };

  return (
    <div className="w-full md:w-1/3 border-r border-border bg-muted/30 p-4 flex flex-col overflow-y-auto select-none">
      <h3 className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3">Generated Directory</h3>
      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex items-center gap-2 text-foreground font-semibold py-1">
          <Icon icon="lucide:folder" className="text-emerald-400 text-sm" />
          <span>infraflow-bundle/</span>
        </div>
        {Object.entries(folders).map(([dir, dirFiles]) => {
          if (dir === '__root__') {
            return (
              <div key="root" className="pl-4 space-y-1 mt-1">
                {dirFiles.map(renderFileBtn)}
              </div>
            );
          }
          const meta = FOLDER_META[dir] || { label: `${dir}/`, color: 'text-foreground', icon: 'lucide:folder' };
          return (
            <div key={dir} className="pl-4 space-y-1 mt-1">
              <div className="flex items-center gap-2 font-medium py-1">
                <Icon icon={meta.icon} className={clsx(meta.color, 'text-sm')} />
                <span className={meta.color}>{meta.label}</span>
              </div>
              <div className="pl-4 space-y-1">
                {dirFiles.map(renderFileBtn)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CodeViewerProps {
  selectedFile: FileItem;
  isCopied: boolean;
  onCopy: () => void;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ selectedFile, isCopied, onCopy }) => {
  // TODO: This syntax highlighter uses simple regex splitting for visual demonstration. Future engineers should replace this with a proper code-highlighting engine like Monaco Editor, Shiki, or Prism.js.
  // Simulates line by line token highlights
  const highlightCode = (code: string, lang: string) => {
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      if (line.trim().startsWith('#') || line.trim().startsWith('//') || line.trim().startsWith('---')) {
        return <div key={idx} className="text-emerald-500">{line}</div>;
      }
      
      let renderedLine: React.ReactNode = line;
      if (lang === 'HCL' || lang === 'YAML' || lang === 'INI' || lang === 'Markdown') {
        const parts = line.split(/("[^"]*")/g);
        renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return <span key={pIdx} className="text-orange-400">{part}</span>;
          }
          
          if (part.includes('resource ') || part.includes('provider ') || part.includes('variable ') || part.includes('output ')) {
            const subParts = part.split(/(resource|provider|variable|output)/g);
            return subParts.map((sub, sIdx) => {
              if (['resource', 'provider', 'variable', 'output'].includes(sub)) {
                return <span key={sIdx} className="text-purple-400">{sub}</span>;
              }
              return sub;
            });
          }
          
          return part;
        });
      }

      return <div key={idx} className="min-h-[1.25rem]">{renderedLine}</div>;
    });
  };

  return (
    <div className="w-full md:w-2/3 flex flex-col overflow-hidden bg-background">
      {/* Tabbed Code Viewer Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
            {selectedFile.language}
          </span>
          <span className="text-xs font-semibold text-foreground">{selectedFile.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground font-mono">
            {selectedFile.lines} lines • {selectedFile.size}
          </span>
          <button
            onClick={onCopy}
            className="text-xs text-primary hover:text-primary/90 font-semibold flex items-center gap-1 px-2 py-1 hover:bg-muted rounded transition-colors cursor-pointer"
          >
            <Icon icon={isCopied ? "lucide:check" : "lucide:copy"} className="text-sm" />
            <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      {/* Code View Area */}
      <div className="flex-1 overflow-y-auto p-6 font-mono text-xs text-muted-foreground leading-relaxed bg-[#080B11]">
        <pre className="whitespace-pre-wrap break-all">
          <code>{highlightCode(selectedFile.content, selectedFile.language)}</code>
        </pre>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function ExportCodeModalOverlay() {
  const router = useRouter();
  const { nodes, edges } = useCanvasStore();

  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Compile files dynamically from canvas Zustand store
  const bundleFiles = useMemo(() => generateBundleFiles(nodes, edges), [nodes, edges]);

  // Auto-select first file whenever the file list changes
  useEffect(() => {
    if (bundleFiles.length > 0 && (!selectedFilePath || !bundleFiles.find(f => f.path === selectedFilePath))) {
      setSelectedFilePath(bundleFiles[0].path);
    }
  }, [bundleFiles]);

  const activeFile = useMemo(
    () => bundleFiles.find(f => f.path === selectedFilePath) ?? bundleFiles[0],
    [bundleFiles, selectedFilePath]
  );

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setIsCopied(false);
  };

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleDownloadBundle = async () => {
    setIsDownloading(true);
    try {
      await downloadZipBundle(nodes, edges);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    router.push('/workspace');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col relative font-sans overflow-hidden">
      {/* Underlay: Simulating the live visual canvas blurred behind the modal */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-xl z-0 pointer-events-none"></div>

      {/* Top Global Navigation Bar (Page Specific Header) */}
      <header className="h-16 border-b border-border bg-card/60 px-6 flex items-center justify-between z-10 shrink-0 select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md">
              <Icon icon="lucide:layers" className="text-primary-foreground text-lg" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">InfraFlow</span>
          </div>
          <div className="h-4 w-[1px] bg-border"></div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Project Alpha</span>
            <Icon icon="lucide:chevron-right" className="text-muted-foreground text-xs" />
            <span className="text-foreground font-medium font-heading">Web-Server-Orchestration</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
            <span className="px-2 text-xs font-mono font-semibold text-foreground select-none">100%</span>
          </div>
          <button 
            onClick={handleOpenModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-primary/20"
          >
            <Icon icon="lucide:download" className="text-base" />
            <span>Export Code</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Area (Background simulation) */}
      <div className="flex-1 flex items-center justify-center p-6 z-10 relative">
        {!isModalOpen && (
          <div className="text-center max-w-md p-8 bg-card border border-border rounded-2xl shadow-xl">
            <Icon icon="lucide:check-circle" className="text-emerald-500 text-5xl mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Workspace Ready</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Your visual infrastructure orchestration is complete. Click the button below to review and export your code bundle.
            </p>
            <button
              onClick={handleOpenModal}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-primary/20"
            >
              <Icon icon="lucide:download" className="text-lg" />
              <span>Open Export Modal</span>
            </button>
          </div>
        )}

        {/* Modal Overlay Container */}
        {isModalOpen && (
          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6 z-50 bg-background/80 backdrop-blur-sm">
            {/* Modal Card */}
            <div className="w-full max-w-5xl bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/50 flex flex-col max-h-[90%] md:max-h-[640px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-border flex items-center justify-between select-none">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/10">
                    <Icon icon="lucide:download" className="text-primary-foreground text-xl" />
                  </div>
                  <div>
                    <h2 className="text-lg font-heading font-bold text-foreground">Export Infrastructure Code Bundle</h2>
                    <p className="text-xs text-muted-foreground">Review directory structure and generated files before downloading.</p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon icon="lucide:x" className="text-xl" />
                </button>
              </div>

              {/* Modal Body (Side-by-Side View) */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {bundleFiles.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
                    <Icon icon="lucide:layout-template" className="text-4xl opacity-30" />
                    <p className="text-sm font-medium">Canvas is empty</p>
                    <p className="text-xs text-center max-w-xs">Add Terraform, Ansible, or Kubernetes nodes to the canvas and come back to export the generated code.</p>
                    <button onClick={handleCloseModal} className="mt-2 text-xs text-primary hover:underline cursor-pointer">Go to canvas</button>
                  </div>
                ) : (
                  <>
                    {/* Left Pane: Directory Structure & File Tree */}
                    <DirectoryTree
                      selectedFile={selectedFilePath}
                      onFileSelect={handleFileSelect}
                      files={bundleFiles}
                    />
                    {/* Right Pane: Tabbed Code Viewer & Preview */}
                    {activeFile && (
                      <CodeViewer
                        selectedFile={activeFile}
                        isCopied={isCopied}
                        onCopy={handleCopyCode}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon icon="lucide:info" className="text-sm text-primary shrink-0" />
                  <span>Bundle compiles Terraform, Ansible, and Kubernetes into modular directory layouts.</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button 
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-border border border-border rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDownloadBundle}
                    disabled={isDownloading}
                    className="px-5 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                  >
                    {isDownloading ? (
                      <>
                        <Icon icon="lucide:loader-2" className="text-base animate-spin" />
                        <span>Generating Bundle...</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="lucide:download" className="text-base" />
                        <span>Download Bundle (.zip)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
