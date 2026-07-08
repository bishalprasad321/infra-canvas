'use client';

import { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // Don't forget the core styles!

import ServerNode from './components/ServerNode';
import useCanvasStore from './store/useCanvasStore';


export default function CanvasPage() {
  // Hook into the Zustand store
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore();
  // 2. Register custom nodes
  // CRITICAL: useMemo ensures this object isn't recreated on every render, 
  // which prevents React Flow from unmounting/remounting nodes constantly.
  const nodeTypes = useMemo(() => ({ serverNode: ServerNode }), []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
