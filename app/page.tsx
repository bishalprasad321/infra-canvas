'use client';

import { useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useCanvasStore from './store/useCanvasStore';
import ServerNode from './components/ServerNode';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';

// We extract the actual canvas logic into a child component 
// so it can access the ReactFlow context via useReactFlow()
function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useCanvasStore();
  const { screenToFlowPosition } = useReactFlow();

  const nodeTypes = useMemo(() => ({ serverNode: ServerNode }), []);

  // Required to allow the drop effect
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handles the actual drop event
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Extract the data we packed in the Sidebar
      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      // Check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      // Convert pixel drop location to React Flow canvas coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Generate a unique ID for the new node
      const newNodeId = `dndnode_${Date.now()}`;

      // Create the new node object
      const newNode = {
        id: newNodeId,
        type,
        position,
        data: { label: label, icon: label.includes('Nginx') ? '🌐' : '📦' },
      };

      // Push it to the Zustand store
      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  return (
    <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
      {/* Empty placeholder */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-slate-500 text-lg font-medium tracking-wide">
            Drag modules here to start building your infrastructure.
          </p>
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
      >
        <Background color="#333" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// The main page wraps everything in the Provider and sets up the layout
export default function CanvasPage() {
  return (
    <div className="flex w-screen h-screen bg-slate-950 overflow-hidden">
      {/* TODO: Add top toolbar layout (Deployment Flow and Deploy Button)*/}
      {/* 1. Left Panel (Modules Bar) */}
      <Sidebar />

      {/* 2. Middle Column: The Canvas */}
      <div className="flex-grow flex flex-col relative h-full">
        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>
      </div>

      {/* 3. Right Panel (Generated YAML) */}
      <RightPanel />
    </div>
  );
}