'use client';

import useCanavasStore from '../store/useCanvasStore';

export default function NodeConfigPanel() {
    const { nodes, selectedNodeId, updateNodeData, setSelectedNodeId } = useCanavasStore();

    // find actual node object based on the selected id
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    if (!selectedNode) return null;

    const label = selectedNode.data.label as string;

    return (
        <div className="absolute top-4 right-4 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50 text-white">
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
        <h3 className="font-bold text-sm">Configure: {label}</h3>
        <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* Conditionally render inputs based on the node */}
      {label.includes('Create PostgreSQL User') && (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Database User</span>
            <input 
              type="text"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 outline-none focus:border-emerald-500"
              value={(selectedNode.data.dbUser as string) || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { dbUser: e.target.value })}
              placeholder="e.g., admin"
            />
          </label>
          {/* TODO: Add more fields like dbPassword, port, etc. */}
        </div>
      )}

      {label.includes('Open Port') && (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Port Number</span>
            <input 
              type="number"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500"
              value={(selectedNode.data.port as number) || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { port: e.target.value })}
              placeholder="e.g., 8080"
            />
          </label>
        </div>
      )}
    </div>

    );
}