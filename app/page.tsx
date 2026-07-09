'use client';

import { useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useCanvasStore from './store/useCanvasStore';
import ServerNode from './components/ServerNode';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import { Button } from './lib/uiComponents';
import NodeSettingsModal from './components/NodeSettingsModal';

// Canvas component that uses ReactFlow context
function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNodeId } = useCanvasStore();
  const { screenToFlowPosition } = useReactFlow();

  const nodeTypes = useMemo(() => ({ serverNode: ServerNode }), []);

  // create click handler
  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // add a click on the background to deselect when clicking on the empty space
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = `dndnode_${Date.now()}`;

      const newNode = {
        id: newNodeId,
        type,
        position,
        data: { label: label, icon: label.includes('Nginx') ? '🌐' : '📦' },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
      {/* Empty state placeholder */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-30">🏗️</div>
            <p className="text-slate-400 text-lg font-medium tracking-wide">
              Drag modules from the sidebar to start building your infrastructure
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Connect nodes to define deployment sequences
            </p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
      >
        <Background color="#334155" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// Main page component
export default function CanvasPage() {
  const { nodes } = useCanvasStore();

  return (
    <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-16 border-b border-slate-700/50 bg-gradient-to-r from-slate-900/80 to-slate-900/50 backdrop-blur-md flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">⚙️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">InfraCanvas</h1>
            <p className="text-xs text-slate-400">Visual Infrastructure Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-slate-400">Tasks: </span>
            <span className="text-white font-semibold">{nodes.length}</span>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <Button size="sm" variant="primary" disabled>
            🚀 Deploy
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Sidebar */}
        <Sidebar />

        {/* Middle - Canvas */}
        <div className="flex-grow flex flex-col relative h-full">
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        </div>

        {/* Right Panel - YAML Output */}
        <RightPanel />
        {/* NodeSettingsModal */}
        <NodeSettingsModal />
      </div>
    </div>
  );
}