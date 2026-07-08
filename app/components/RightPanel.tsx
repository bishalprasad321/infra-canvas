'use client';

import { useMemo } from 'react';
import useCanvasStore from '../store/useCanvasStore';
// Adjust the import path based on where you placed the utility function
import { generateAnsibleYAML } from '../lib/exportYaml'; 

export default function RightPanel() {
  // Hook into the Zustand store to observe node changes
  const { nodes, edges } = useCanvasStore();
  
  // Re-generate the YAML only when nodes or edges change
  const yamlCode = useMemo(() => generateAnsibleYAML(nodes, edges), [nodes, edges]);

  // Utility function: Copy to Clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlCode);
      alert('Playbook copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Utility function: Download as .yml file
  const handleDownload = () => {
    const blob = new Blob([yamlCode], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'infrastructure-playbook.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-[450px] bg-[#0B1120] border-l border-slate-800 flex flex-col shrink-0">
      
      {/* Panel Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono font-bold">{"<>"}</span>
          <span className="text-slate-200 font-semibold text-sm">Generated YAML</span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-yellow-900/20 text-yellow-500 border border-yellow-700/50 hover:bg-yellow-900/40 transition-colors text-xs font-medium">
             🛡️ Audit Security
          </button>
          <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors" title="Copy code">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button onClick={handleDownload} className="text-slate-400 hover:text-white transition-colors" title="Download .yml">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-grow p-4 overflow-y-auto bg-[#0B1120]">
        <pre className="font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap">
          <code>
            {yamlCode}
          </code>
        </pre>
      </div>
    </aside>
  );
}
