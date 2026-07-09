import { Handle, Position } from '@xyflow/react';
import useCanvasStore from '../store/useCanvasStore';

// Category mapping for node types
const categoryMap: Record<string, { type: string; color: string }> = {
  'Update Packages': { type: 'SYSTEM', color: 'bg-slate-700/40 text-slate-300' },
  'Install Nginx': { type: 'WEB', color: 'bg-indigo-700/40 text-indigo-300' },
  'Install Node.js': { type: 'WEB', color: 'bg-indigo-700/40 text-indigo-300' },
  'PostgreSQL': { type: 'DATABASE', color: 'bg-emerald-700/40 text-emerald-300' },
  'Open Port': { type: 'NETWORK', color: 'bg-blue-700/40 text-blue-300' },
  'Copy .env File': { type: 'FILE', color: 'bg-purple-700/40 text-purple-300' },
};

// Neutral icon mapping
const iconMap: Record<string, string> = {
  'Update Packages': '📦',
  'Install Nginx': '🖥️',
  'Install Node.js': '⚙️',
  'PostgreSQL': '🗄️',
  'Open Port': '🔒',
  'Copy .env File': '📄',
};

export default function ServerNode({ id, data }: { id: string, data: { label: string; icon?: string } }) {
  // hook into the store to set the active mode
  const { setSelectedNodeId } = useCanvasStore();
  const icon = iconMap[data.label] || data.icon || '⚙️';
  const category = categoryMap[data.label] || { type: 'TASK', color: 'bg-slate-700/40 text-slate-300' };

  return (
    <div className="flex flex-col gap-0 select-none">
      {/* INPUT HANDLE - Top */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-indigo-400 border-2 border-indigo-300 rounded-full !opacity-0 hover:!opacity-100 transition-opacity" 
      />

      {/* NODE CONTENT - Themed card style */}
      <div className="relative px-4 py-3 bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 rounded-lg min-w-[180px] shadow-md hover:shadow-lg transition-all duration-200 backdrop-blur-sm group">
        
        {/* Settings icon - apprars on group hover */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeId(id);
          }}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-emareld-400 opacity-0 group-hover:opacity-100 transition-all z-10" 
          title="Configure Node"
        >
          ⚙️
        </button>

        {/* Category Badge */}
        <div className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${category.color} mb-2 w-fit border border-current/30`}>
          {category.type}
        </div>

        {/* Icon and Label */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
            {icon}
          </span>
          <div className="font-semibold text-slate-100 text-sm leading-tight break-words">
            {data.label}
          </div>
        </div>

        {/* Metadata - subtle detail */}
        <div className="text-xs text-slate-400 font-mono mt-1 pl-8">
          Ubuntu 22.04
        </div>
      </div>

      {/* OUTPUT HANDLE - Bottom */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-emerald-400 border-2 border-emerald-300 rounded-full !opacity-0 hover:!opacity-100 transition-opacity" 
      />
    </div>
  );
}