'use client';

import * as React from 'react';

// Particle type for canvas rendering
type Particle = {
  ox: number;
  oy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  color: string;
  alpha: number;
};

const DARK_COLORS = [
  '#06B6D4', // cyan-500
  '#0891B2', // cyan-600
  '#7C3AED', // violet-600
  '#8B5CF6', // violet-500
  '#6366F1', // indigo-500
  '#0EA5E9', // sky-500
  '#A78BFA', // violet-400
  '#22D3EE', // cyan-400
];

export interface ParticleFieldProps {
  /** Average spacing between particles in px. @default 64 */
  dotGap?: number;
  /** Radius around cursor where particles repel (px). @default 140 */
  interactionRadius?: number;
  /** Repulsion force strength. @default 8 */
  repulsionStrength?: number;
  /** Spring constant pulling particles home. @default 0.06 */
  springK?: number;
  /** Velocity damping per frame (0-1). @default 0.82 */
  damping?: number;
  /** Particle colours. Defaults to dark-mode cyan/violet palette. */
  colors?: string[];
  /** Background colour. @default "transparent" */
  background?: string;
  className?: string;
}

export function ParticleField({
  dotGap = 64,
  interactionRadius = 140,
  repulsionStrength = 8,
  springK = 0.06,
  damping = 0.82,
  colors = DARK_COLORS,
  background = 'transparent',
  className,
}: ParticleFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef({ x: -9999, y: -9999, active: false });
  const particlesRef = React.useRef<Particle[]>([]);
  const rafRef = React.useRef<number>(0);

  // Check reduced motion preference
  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const buildParticles = React.useCallback(
    (W: number, H: number): Particle[] => {
      const jitter = dotGap * 0.55;
      const cols = Math.ceil(W / dotGap) + 1;
      const rows = Math.ceil(H / dotGap) + 1;
      const ps: Particle[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ox = c * dotGap + (Math.random() - 0.5) * jitter * 2;
          const oy = r * dotGap + (Math.random() - 0.5) * jitter * 2;
          ps.push({
            ox,
            oy,
            x: ox,
            y: oy,
            vx: 0,
            vy: 0,
            w: 1.5 + Math.random() * 1.2,
            h: 6 + Math.random() * 8,
            rot: Math.random() * Math.PI * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 0.3 + Math.random() * 0.25,
          });
        }
      }
      return ps;
    },
    [dotGap, colors]
  );

  // Mouse / touch tracking
  React.useEffect(() => {
    const updateMouse = (cx: number, cy: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: cx - r.left, y: cy - r.top, active: true };
    };
    const onMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('touchend', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('touchend', onLeave);
    };
  }, []);

  // Animation loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cvs = canvas;
    const c = ctx;

    let W = 0,
      H = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      W = cvs.offsetWidth;
      H = cvs.offsetHeight;
      cvs.width = W * dpr;
      cvs.height = H * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = buildParticles(W, H);
    }

    const isVisibleRef = { current: true };

    const io = new IntersectionObserver(
      ([e]) => {
        isVisibleRef.current = e?.isIntersecting ?? true;
        if (isVisibleRef.current && !document.hidden && !rafRef.current) {
          rafRef.current = requestAnimationFrame(draw);
        }
      },
      { threshold: 0.01 }
    );
    io.observe(cvs);

    function onVisibilityChange() {
      if (!document.hidden && isVisibleRef.current && !rafRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    function draw() {
      if (document.hidden || !isVisibleRef.current) {
        rafRef.current = 0;
        return;
      }
      c.clearRect(0, 0, W, H);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const active = mouseRef.current.active && !prefersReducedMotion;
      const ir = interactionRadius;
      const ir2 = ir * ir;

      for (const p of particlesRef.current) {
        if (active) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist2 = dx * dx + dy * dy;

          if (dist2 < ir2 && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const force = ((ir - dist) / ir) ** 2 * repulsionStrength;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx += (p.ox - p.x) * springK;
        p.vy += (p.oy - p.y) * springK;
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx;
        p.y += p.vy;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const stretch = Math.min(speed * 0.6, 6);
        const drawH = p.h + stretch;

        c.save();
        c.translate(p.x, p.y);
        const velAngle =
          speed > 0.5 ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.rot;
        c.rotate(speed > 0.5 ? velAngle : p.rot);
        c.globalAlpha = p.alpha;
        c.fillStyle = p.color;

        const hw = p.w / 2;
        const hh = drawH / 2;
        const cr = hw;
        c.beginPath();
        c.moveTo(-hw + cr, -hh);
        c.lineTo(hw - cr, -hh);
        c.quadraticCurveTo(hw, -hh, hw, -hh + cr);
        c.lineTo(hw, hh - cr);
        c.quadraticCurveTo(hw, hh, hw - cr, hh);
        c.lineTo(-hw + cr, hh);
        c.quadraticCurveTo(-hw, hh, -hw, hh - cr);
        c.lineTo(-hw, -hh + cr);
        c.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
        c.closePath();
        c.fill();
        c.restore();
      }

      c.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(cvs);
    resize();
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [dotGap, interactionRadius, repulsionStrength, springK, damping, colors, prefersReducedMotion, buildParticles]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? 'absolute inset-0 h-full w-full'}
      style={{ pointerEvents: 'none', background }}
    />
  );
}
