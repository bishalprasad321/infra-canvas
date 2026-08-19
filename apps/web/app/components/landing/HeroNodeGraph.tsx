'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sparkles } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';

// A loose "infrastructure graph" — a hub node with spokes and a couple of
// secondary links, evoking the node/edge canvas InfraCanvas itself renders.
// Positions are hand-placed (not randomized) so the composition stays
// intentional and framing the hero copy rather than cluttering it.

type NodeSpec = {
  position: [number, number, number];
  size: number;
  color: string;
  hub?: boolean;
};

const CYAN = '#22D3EE';
const VIOLET = '#A78BFA';
const EMERALD = '#34D399';

const NODES: NodeSpec[] = [
  { position: [0, 0.3, -3], size: 0.55, color: VIOLET, hub: true },
  { position: [-4.2, 1.8, -1], size: 0.32, color: CYAN },
  { position: [-3.6, -1.6, -2], size: 0.24, color: EMERALD },
  { position: [-5.0, -0.3, -2.5], size: 0.28, color: VIOLET },
  { position: [4.3, 1.6, -1.2], size: 0.34, color: CYAN },
  { position: [3.8, -1.8, -1.8], size: 0.26, color: VIOLET },
  { position: [5.1, 0.1, -2.6], size: 0.3, color: EMERALD },
  { position: [-2.0, 3.0, -2.2], size: 0.2, color: CYAN },
  { position: [2.2, 3.1, -2.0], size: 0.22, color: VIOLET },
  { position: [-1.6, -3.0, -2.4], size: 0.22, color: EMERALD },
  { position: [1.8, -3.1, -2.2], size: 0.24, color: CYAN },
  { position: [-6.0, 1.0, -3.5], size: 0.2, color: VIOLET },
  { position: [6.0, -1.0, -3.5], size: 0.2, color: CYAN },
];

const EDGES: Array<[number, number]> = [
  [0, 1], [0, 3], [0, 4], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10],
  [1, 11], [6, 12], [1, 3], [4, 6],
];

const PULSE_EDGES: Array<{ edge: [number, number]; speed: number; delay: number; color: string }> = [
  { edge: [0, 4], speed: 0.35, delay: 0, color: CYAN },
  { edge: [0, 1], speed: 0.28, delay: 0.4, color: VIOLET },
  { edge: [0, 6], speed: 0.4, delay: 0.75, color: EMERALD },
];

function GraphNode({ node }: { node: NodeSpec }) {
  const reduceMotion = useReducedMotion();
  return (
    <Float
      speed={reduceMotion ? 0 : 1.1}
      rotationIntensity={reduceMotion ? 0 : 0.5}
      floatIntensity={reduceMotion ? 0 : node.hub ? 0.4 : 0.9}
    >
      <mesh position={node.position}>
        <icosahedronGeometry args={[node.size, node.hub ? 1 : 0]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={node.hub ? 0.5 : 0.35}
          roughness={0.35}
          metalness={0.4}
          transparent
          opacity={node.hub ? 0.9 : 0.75}
        />
      </mesh>
    </Float>
  );
}

function GraphEdges() {
  return (
    <>
      {EDGES.map(([a, b], i) => (
        <Line
          key={i}
          points={[NODES[a].position, NODES[b].position]}
          color={CYAN}
          transparent
          opacity={0.16}
          lineWidth={1}
        />
      ))}
    </>
  );
}

function EdgePulse({ edge, speed, delay, color }: { edge: [number, number]; speed: number; delay: number; color: string }) {
  const ref = React.useRef<THREE.Mesh>(null);
  const reduceMotion = useReducedMotion();
  const from = React.useMemo(() => new THREE.Vector3(...NODES[edge[0]].position), [edge]);
  const to = React.useMemo(() => new THREE.Vector3(...NODES[edge[1]].position), [edge]);

  useFrame(({ clock }) => {
    if (!ref.current || reduceMotion) return;
    const t = (clock.getElapsedTime() * speed + delay) % 1;
    ref.current.position.lerpVectors(from, to, t);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.sin(t * Math.PI) * 0.85;
  });

  if (reduceMotion) return null;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0} />
    </mesh>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = React.useRef<THREE.Group>(null);
  const pointer = React.useRef({ x: 0, y: 0 });
  const autoRotation = React.useRef(0);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    if (!reduceMotion) {
      autoRotation.current += delta * 0.045;
    }

    const targetY = autoRotation.current + (reduceMotion ? 0 : pointer.current.x * 0.3);
    const targetX = reduceMotion ? 0 : pointer.current.y * 0.18;

    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });

  return <group ref={group}>{children}</group>;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[6, 6, 6]} intensity={45} color={CYAN} />
      <pointLight position={[-6, -4, 4]} intensity={35} color={VIOLET} />
      <Rig>
        <GraphEdges />
        {NODES.map((node, i) => (
          <GraphNode key={i} node={node} />
        ))}
        {PULSE_EDGES.map((p, i) => (
          <EdgePulse key={i} {...p} />
        ))}
        <Sparkles count={40} scale={[12, 7, 6]} size={1.4} speed={0.2} opacity={0.35} color={CYAN} />
      </Rig>
    </>
  );
}

// WebGL context creation can fail on locked-down or ancient browsers — the
// hero must degrade to the gradient background rather than take the page down.
class Canvas3DBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function HeroNodeGraph({ className }: { className?: string }) {
  return (
    <div className={className ?? 'absolute inset-0'} style={{ pointerEvents: 'none' }}>
      <Canvas3DBoundary>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 9], fov: 45 }}
        >
          <Scene />
        </Canvas>
      </Canvas3DBoundary>
    </div>
  );
}

export default HeroNodeGraph;
