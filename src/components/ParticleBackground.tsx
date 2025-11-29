import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
  dataCount?: number; // Represents real data points
}

export function ParticleBackground({ 
  particleCount = 50, 
  interactive = true,
  dataCount = 0 
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  const colors = [
    'hsl(185, 70%, 50%)',  // Primary cyan
    'hsl(280, 70%, 60%)',  // Accent purple
    'hsl(160, 65%, 50%)',  // Green
    'hsl(45, 80%, 55%)',   // Amber
    'hsl(340, 70%, 55%)',  // Pink
  ];

  const createParticle = useCallback((width: number, height: number): Particle => {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
    };
  }, []);

  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const count = Math.min(particleCount + Math.floor(dataCount / 10), 150);
    particlesRef.current = Array.from({ length: count }, () => 
      createParticle(canvas.width, canvas.height)
    );
  }, [particleCount, dataCount, createParticle]);

  const updateParticle = useCallback((particle: Particle, width: number, height: number) => {
    // Mouse interaction
    if (interactive) {
      const dx = mouseRef.current.x - particle.x;
      const dy = mouseRef.current.y - particle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 150) {
        const force = (150 - dist) / 150;
        particle.vx -= (dx / dist) * force * 0.02;
        particle.vy -= (dy / dist) * force * 0.02;
      }
    }

    // Apply velocity with damping
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.99;
    particle.vy *= 0.99;

    // Add slight drift back to center area
    particle.vx += (width / 2 - particle.x) * 0.00001;
    particle.vy += (height / 2 - particle.y) * 0.00001;

    // Wrap around edges
    if (particle.x < 0) particle.x = width;
    if (particle.x > width) particle.x = 0;
    if (particle.y < 0) particle.y = height;
    if (particle.y > height) particle.y = 0;

    // Pulse animation
    particle.pulse += particle.pulseSpeed;
  }, [interactive]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connection lines between close particles
    particlesRef.current.forEach((p1, i) => {
      particlesRef.current.slice(i + 1).forEach(p2 => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.15;
          ctx.strokeStyle = `hsla(185, 70%, 50%, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });
    });

    // Draw particles
    particlesRef.current.forEach(particle => {
      updateParticle(particle, canvas.width, canvas.height);

      const pulseAlpha = particle.alpha + Math.sin(particle.pulse) * 0.15;
      const pulseSize = particle.size + Math.sin(particle.pulse) * 0.5;

      // Outer glow
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, pulseSize * 4
      );
      gradient.addColorStop(0, particle.color.replace(')', `, ${pulseAlpha * 0.5})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, pulseSize * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core particle
      ctx.fillStyle = particle.color.replace(')', `, ${pulseAlpha})`).replace('hsl', 'hsla');
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(draw);
  }, [updateParticle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initParticles, draw, interactive]);

  // Reinitialize when data count changes significantly
  useEffect(() => {
    initParticles();
  }, [dataCount, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
