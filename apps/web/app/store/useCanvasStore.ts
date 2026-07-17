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
    deleteNode: (nodeId: string) => void;
    setSelectedNodeId: (id: string | null) => void;
    updateNodeData: (nodeId: string, newData: any) => void;
    resetCanvas: () => void;
};

// Initial nodes reflecting the 4 pre-populated nodes from design-idea
const getInitialNodes = (): Node[] => [
  {
    id: 'aws_security_group.web_sg',
    type: 'customNode',
    position: { x: 160, y: 96 },
    data: {
      label: 'aws_security_group.web_sg',
      tech: 'Terraform',
      icon: 'lucide:shield',
      categoryLabel: 'AWS SG',
      description: 'Allows HTTP/HTTPS inbound & SSH access.',
      status: 'Validated',
      statusText: 'Validated'
    }
  },
  {
    id: 'aws_instance.web_server',
    type: 'customNode',
    position: { x: 380, y: 48 },
    data: {
      label: 'aws_instance.web_server',
      tech: 'Terraform',
      icon: 'lucide:globe',
      categoryLabel: 'AWS EC2',
      description: 't3.medium instance running Ubuntu 22.04.',
      status: 'Validated',
      statusText: 'Validated',
      parameters: {
        instanceName: 'web_server',
        amiId: 'ami-0c7217cdde317cfec',
        instanceType: 't3.medium',
        subnetId: 'subnet-0123456789abcdef0',
        rootVolumeSize: 50,
        tags: [
          { key: 'Environment', value: 'prod' },
          { key: 'Role', value: 'web' }
        ]
      }
    }
  },
  {
    id: 'install_nginx.yml',
    type: 'customNode',
    position: { x: 700, y: 192 },
    data: {
      label: 'Install Nginx',
      tech: 'Ansible',
      icon: 'lucide:zap',
      categoryLabel: 'Ansible Playbook',
      description: 'Installs, configures, and starts latest Nginx.',
      status: 'Editing',
      statusText: 'Editing',
      editorName: 'Sarah'
    }
  },
  {
    id: 'deploy_site_assets',
    type: 'customNode',
    position: { x: 1020, y: 288 },
    data: {
      label: 'Copy .env File',
      tech: 'Ansible',
      icon: 'lucide:copy',
      categoryLabel: 'Ansible Task',
      description: 'Source path needs authentication keys.',
      status: 'Warning',
      statusText: 'Warning'
    }
  }
];

// Initial edges matching the design-idea connection layouts and styling
const getInitialEdges = (): Edge[] => [
  {
    id: 'e_sg_instance',
    source: 'aws_security_group.web_sg',
    target: 'aws_instance.web_server',
    style: { stroke: '#844FBA', strokeWidth: 2.5 },
    animated: false
  },
  {
    id: 'e_instance_nginx',
    source: 'aws_instance.web_server',
    target: 'install_nginx.yml',
    style: { stroke: 'url(#grad-tf-ansible)', strokeWidth: 2.5 },
    className: 'animate-dash-flow',
    animated: true
  },
  {
    id: 'e_nginx_assets',
    source: 'install_nginx.yml',
    target: 'deploy_site_assets',
    style: { stroke: '#00A4FF', strokeWidth: 2.5 },
    animated: false
  }
];

// Create the Zustand store
const useCanvasStore = create<CanvasState>((set, get) => ({
    nodes: [],
    edges: [],
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

    addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
    },

    deleteNode: (nodeId) => {
        set((state) => ({
            nodes: state.nodes.filter((node) => node.id !== nodeId),
            edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
        }));
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
        // Resolve technology of source and target to determine edge styles
        const sourceNode = get().nodes.find(n => n.id === connection.source);
        const targetNode = get().nodes.find(n => n.id === connection.target);
        
        let stroke = '#00A4FF'; // Default Ansible color
        let className = '';
        let animated = false;

        if (sourceNode && targetNode) {
          const sourceTech = sourceNode.data.tech;
          const targetTech = targetNode.data.tech;

          if (sourceTech === 'Terraform' && targetTech === 'Terraform') {
            stroke = '#844FBA';
          } else if (sourceTech === 'Terraform' && targetTech === 'Ansible') {
            stroke = 'url(#grad-tf-ansible)';
            className = 'animate-dash-flow';
            animated = true;
          } else if (sourceTech === 'Ansible' && targetTech === 'Kubernetes') {
            stroke = 'url(#grad-ansible-k8s)';
          } else if (sourceTech === 'Kubernetes' && targetTech === 'Kubernetes') {
            stroke = '#326CE5';
          }
        }

        const newEdge: Edge = {
          id: `reactflow__edge-${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          style: { stroke, strokeWidth: 2.5 },
          className,
          animated
        };

        set({
            edges: addEdge(newEdge, get().edges),
        });
    },

    setNodes: (nodes: Node[]) => set({ nodes }),
    setEdges: (edges: Edge[]) => set({ edges }),
    
    resetCanvas: () => {
      set({
        nodes: [],
        edges: [],
        selectedNodeId: null
      });
    }
}));

export default useCanvasStore;