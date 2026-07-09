'use client';

import useCanvasStore from '../store/useCanvasStore';

export default function NodeSettingsModal() {
  const { nodes, selectedNodeId, updateNodeData, setSelectedNodeId } = useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // If no node is selected, render nothing
  if (!selectedNode) return null;

  const label = selectedNode.data.label as string;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[400px] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-800 px-5 py-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-slate-100 font-semibold flex items-center gap-2">
            ⚙️ Configure: {label}
          </h3>
          <button 
            onClick={() => setSelectedNodeId(null)} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Dynamic Form Content */}
        <div className="p-5 flex flex-col gap-4">
          
          {/* Example 1: PostgreSQL Settings */}
          {label.includes('Create PostgreSQL User') && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database User</span>
                <input 
                  type="text"
                  className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={(selectedNode.data.dbUser as string) || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { dbUser: e.target.value })}
                  placeholder="e.g., admin"
                />
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database Password</span>
                <input 
                  type="password"
                  className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={(selectedNode.data.dbPass as string) || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { dbPass: e.target.value })}
                  placeholder="••••••••"
                />
              </label>
            </>
          )}

          {/* Example 2: Open Port Settings */}
          {label.includes('Open Port') && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Port Number</span>
              <input 
                type="number"
                className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                value={(selectedNode.data.port as number) || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { port: e.target.value })}
                placeholder="e.g., 80, 443, 8080"
              />
            </label>
          )}

          {/* Empty State for nodes without specific config yet */}
          {!label.includes('Create PostgreSQL User') && !label.includes('Open Port') && (
            <div className="text-slate-500 text-sm text-center py-4">
              No additional configuration required for this module.
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="bg-slate-950/50 px-5 py-3 border-t border-slate-800 flex justify-end">
          <button 
            onClick={() => setSelectedNodeId(null)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}