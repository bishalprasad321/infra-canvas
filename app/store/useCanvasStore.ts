import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';

// Define the shape of your state
type CanvasState = {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
};

// Define initial nodes (You can plug your 6 nodes in here for testing)
const initialNodes: Node[] = [
    {
        id: 'update-packages',
        type: 'serverNode', // assuming you used this type from our previous step
        position: { x: 100, y: 100 },
        data: { label: 'Update Packages', icon: '📦' },
    },
    {
        id: 'install-nginx',
        type: 'serverNode',
        position: { x: 100, y: 200 },
        data: { label: 'Install Nginx', icon: '📦' },
    },
    {
        id: 'install-nodejs',
        type: 'serverNode',
        position: { x: 100, y: 300 },
        data: { label: 'Install Node.js', icon: '📦' },
    },
    {
        id: 'postgre-sql',
        type: 'serverNode',
        position: { x: 100, y: 400 },
        data: { label: 'PostgreSQL', icon: '📦' },
    },
    {
        id: 'open-port',
        type: 'serverNode',
        position: { x: 100, y: 500 },
        data: { label: 'Open Port', icon: '📦' },
    },
    {
        id: 'copy-env-file',
        type: 'serverNode',
        position: { x: 100, y: 600 },
        data: { label: 'Copy .env File', icon: '📦' },
    },
];

// Create the Zustand store
const useCanvasStore = create<CanvasState>((set, get) => ({

    nodes: initialNodes,
    edges: [],

    addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
    },

    // Handlers for React Flow
    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },
    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },
    onConnect: (connection: Connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },

    // Utilities for you to programmatically add nodes later
    setNodes: (nodes: Node[]) => set({ nodes }),
    setEdges: (edges: Edge[]) => set({ edges }),
}));

export default useCanvasStore;