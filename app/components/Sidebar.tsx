import React from 'react';

export default function Sidebar() {
  // Packages the node type and label into the drag event
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 text-white">
      <div className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
        Manual Modules
      </div>
      
      {/* Draggable Item 1 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'Update Packages')}
        draggable
      >
        Update Packages
      </div>

      {/* Draggable Item 2 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'Install Nginx')}
        draggable
      >
        Install Nginx
      </div>

      {/* Draggable Item 3 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'Install Node.js')}
        draggable
      >
        Install Node.js
      </div>
      
      {/* Draggable Item 4 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'PostgreSQL')}
        draggable
      >
        PostgreSQL
      </div>

      {/* Draggable Item 5 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'Open Port')}
        draggable
      >
        Open Port
      </div>

      {/* Draggable Item 6 */}
      <div 
        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-md cursor-grab hover:bg-slate-700 transition-colors"
        onDragStart={(event) => onDragStart(event, 'serverNode', 'Copy .env File')}
        draggable
      >
        Copy .env File
      </div>
    </aside>
  );
}