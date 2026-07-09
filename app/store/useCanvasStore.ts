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
    selectedNodeId: string | null;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
    setSelectedNodeId: (id: string | null) => void;
    updateNodeData: (nodeId: string, newData: any) => void;
};

// Define initial nodes (You can plug your 6 nodes in here for testing)
const initialNodes: Node[] = []

// Create the Zustand store
const useCanvasStore = create<CanvasState>((set, get) => ({
    selectedNodeId: null,

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    
    updateNodeData: (nodeId: string, newData: any) => {
        set((state) => ({
            nodes: state.nodes.map((node) => {
                if (node.id === nodeId) {
                    return { 
                        ...node,
                        data: {
                            ...node.data,
                            ...newData
                        }
                    };
                }
                return node;
            }),
        }));
    },

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