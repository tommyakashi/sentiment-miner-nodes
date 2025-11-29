import { useEffect, useRef, useCallback } from 'react';

interface NebulaParticle {
  x: number;
  y: number;
  angle: number;
  radius: number;
  angularVelocity: number;
  radialDrift: number;
  size: number;
  coreColor: string;
  outerColor: string;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
  twinklePhase: number;
  trail: { x: number; y: number; alpha: number }[];
  type: 'nebula' | 'star' | 'dust';
  hasFlare: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  trail: { x: number; y: number; alpha: number }[];
  color: string;
}

interface LensFlare {
  x: number;
  y: number;
  size: number;
  intensity: number;
  color: string;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
  dataCount?: number;
}

// Nebula colors (vibrant for nebulae)
const nebulaColors = [
  { core: 'hsl(280, 70%, 60%)', outer: 'hsl(260, 50%, 30%)' },  // Purple nebula
  { core: 'hsl(185, 70%, 50%)', outer: 'hsl(200, 50%, 25%)' },  // Cyan nebula
  { core: 'hsl(340, 70%, 55%)', outer: 'hsl(320, 40%, 25%)' },  // Pink nebula
  { core: 'hsl(45, 80%, 55%)', outer: 'hsl(30, 60%, 30%)' },    // Gold nebula
  { core: 'hsl(160, 65%, 50%)', outer: 'hsl(140, 40%, 25%)' },  // Teal nebula
];

// Natural star color temperatures (realistic astronomy colors)
const starTemperatureColors = [
  { core: 'hsl(210, 80%, 95%)', outer: 'hsl(210, 60%, 70%)' },   // Hot blue-white (O/B stars)
  { core: 'hsl(200, 50%, 90%)', outer: 'hsl(200, 40%, 65%)' },   // Blue-white (A stars)
  { core: 'hsl(45, 10%, 98%)', outer: 'hsl(45, 8%, 80%)' },      // White (F stars)
  { core: 'hsl(45, 30%, 92%)', outer: 'hsl(45, 25%, 75%)' },     // Yellow-white (G stars - like Sun)
  { core: 'hsl(35, 60%, 80%)', outer: 'hsl(35, 50%, 60%)' },     // Yellow-orange (K stars)
  { core: 'hsl(15, 70%, 70%)', outer: 'hsl(15, 60%, 50%)' },     // Orange-red (M stars)
];

export function ParticleBackground({ 
  particleCount = 35, 
  interactive = true,
  dataCount = 0 
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<NebulaParticle[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const lensFlareRef = useRef<LensFlare[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const centerRef = useRef({ x: 0, y: 0 });
  const lastShootingStarRef = useRef(0);

  const createNebulaParticle = useCallback((width: number, height: number): NebulaParticle => {
    const centerX = width / 2;
    const centerY = height / 2;
    const angle = Math.random() * Math.PI * 2;
    const maxRadius = Math.min(width, height) * 0.45;
    const radius = Math.random() * maxRadius + 50;
    
    const isNebula = Math.random() > 0.6;
    const isStar = !isNebula && Math.random() > 0.5;
    
    // Use natural star colors for stars, vibrant colors for nebulae
    const colorSet = isStar 
      ? starTemperatureColors[Math.floor(Math.random() * starTemperatureColors.length)]
      : nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
    
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      angle,
      radius,
      angularVelocity: (0.0003 + Math.random() * 0.0008) * (Math.random() > 0.5 ? 1 : -1) * (1 - radius / maxRadius * 0.5),
      radialDrift: (Math.random() - 0.5) * 0.05,
      size: isNebula ? Math.random() * 60 + 25 : isStar ? Math.random() * 3 + 1.5 : Math.random() * 2 + 1,
      coreColor: colorSet.core,
      outerColor: colorSet.outer,
      alpha: isNebula ? Math.random() * 0.25 + 0.1 : Math.random() * 0.5 + 0.25,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.008,
      twinklePhase: Math.random() * Math.PI * 2,
      trail: [],
      type: isNebula ? 'nebula' : isStar ? 'star' : 'dust',
      hasFlare: isNebula && Math.random() > 0.7,
    };
  }, []);

  const createShootingStar = useCallback((width: number, height: number): ShootingStar => {
    const startEdge = Math.floor(Math.random() * 4);
    let x: number, y: number, vx: number, vy: number;
    const speed = 8 + Math.random() * 6;
    
    switch (startEdge) {
      case 0: // top
        x = Math.random() * width;
        y = -10;
        vx = (Math.random() - 0.5) * speed;
        vy = speed;
        break;
      case 1: // right
        x = width + 10;
        y = Math.random() * height;
        vx = -speed;
        vy = (Math.random() - 0.5) * speed;
        break;
      case 2: // bottom
        x = Math.random() * width;
        y = height + 10;
        vx = (Math.random() - 0.5) * speed;
        vy = -speed;
        break;
      default: // left
        x = -10;
        y = Math.random() * height;
        vx = speed;
        vy = (Math.random() - 0.5) * speed;
    }

    return {
      x, y, vx, vy,
      life: 0,
      maxLife: 80 + Math.random() * 40,
      trail: [],
      color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)].core,
    };
  }, []);

  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    centerRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
    const count = Math.min(particleCount + Math.floor(dataCount / 15), 80);
    particlesRef.current = Array.from({ length: count }, () => 
      createNebulaParticle(canvas.width, canvas.height)
    );
    shootingStarsRef.current = [];
    lensFlareRef.current = [];
  }, [particleCount, dataCount, createNebulaParticle]);

  const updateParticle = useCallback((particle: NebulaParticle, width: number, height: number, deltaTime: number) => {
    const centerX = centerRef.current.x;
    const centerY = centerRef.current.y;

    // Spiral galaxy motion
    particle.angle += particle.angularVelocity * deltaTime;
    particle.radius += particle.radialDrift * deltaTime * 0.1;
    
    // Keep within bounds
    const maxRadius = Math.min(width, height) * 0.45;
    if (particle.radius > maxRadius) {
      particle.radialDrift = -Math.abs(particle.radialDrift);
    } else if (particle.radius < 50) {
      particle.radialDrift = Math.abs(particle.radialDrift);
    }

    // Calculate new position
    const targetX = centerX + Math.cos(particle.angle) * particle.radius;
    const targetY = centerY + Math.sin(particle.angle) * particle.radius;

    // Store trail
    if (particle.type !== 'dust') {
      particle.trail.unshift({ x: particle.x, y: particle.y, alpha: particle.alpha });
      if (particle.trail.length > 8) particle.trail.pop();
    }

    particle.x = targetX;
    particle.y = targetY;

    // Mouse interaction - gentle push
    if (interactive) {
      const dx = mouseRef.current.x - particle.x;
      const dy = mouseRef.current.y - particle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 200) {
        const force = (200 - dist) / 200;
        particle.radius += force * 0.5;
      }
    }

    // Pulsing and twinkling
    particle.pulse += particle.pulseSpeed * deltaTime;
    particle.twinklePhase += 0.05 * deltaTime;
  }, [interactive]);

  const drawNebulaCloud = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle) => {
    const pulseAlpha = particle.alpha + Math.sin(particle.pulse) * 0.08;
    const pulseSize = particle.size + Math.sin(particle.pulse * 0.5) * particle.size * 0.15;
    const twinkle = Math.sin(particle.twinklePhase) * 0.5 + 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Draw trail (glowing effect)
    particle.trail.forEach((point, i) => {
      const trailAlpha = (1 - i / particle.trail.length) * pulseAlpha * 0.3;
      const trailSize = pulseSize * (1 - i / particle.trail.length * 0.5);
      
      const trailGradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, trailSize
      );
      trailGradient.addColorStop(0, particle.outerColor.replace(')', `, ${trailAlpha * 0.3})`).replace('hsl', 'hsla'));
      trailGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = trailGradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Outer nebula glow (layer 1)
    const outerGradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, pulseSize * 1.5
    );
    outerGradient.addColorStop(0, particle.outerColor.replace(')', `, ${pulseAlpha * 0.4})`).replace('hsl', 'hsla'));
    outerGradient.addColorStop(0.5, particle.outerColor.replace(')', `, ${pulseAlpha * 0.2})`).replace('hsl', 'hsla'));
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, pulseSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core nebula (layer 2)
    const coreGradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, pulseSize
    );
    coreGradient.addColorStop(0, particle.coreColor.replace(')', `, ${pulseAlpha * 0.6 * twinkle})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(0.4, particle.coreColor.replace(')', `, ${pulseAlpha * 0.3})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();

    // Lens flare effect
    if (particle.hasFlare && twinkle > 0.7) {
      drawLensFlare(ctx, particle.x, particle.y, pulseSize * 0.3, particle.coreColor, twinkle);
    }

    ctx.restore();
  }, []);

  const drawStar = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle) => {
    // Smooth sine-wave twinkling only (no random bursts)
    const twinkle = Math.sin(particle.twinklePhase * 2) * 0.3 + 0.7;
    const size = particle.size * twinkle;
    const alpha = particle.alpha * twinkle;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Soft outer glow with natural color
    const outerGlow = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, size * 2
    );
    outerGlow.addColorStop(0, particle.outerColor.replace(')', `, ${alpha * 0.6})`).replace('hsl', 'hsla'));
    outerGlow.addColorStop(0.5, particle.outerColor.replace(')', `, ${alpha * 0.2})`).replace('hsl', 'hsla'));
    outerGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core with natural temperature color
    const coreGradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, size * 0.8
    );
    coreGradient.addColorStop(0, particle.coreColor.replace(')', `, ${alpha * 0.9})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(0.6, particle.coreColor.replace(')', `, ${alpha * 0.4})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const drawDust = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle) => {
    const alpha = particle.alpha * (0.5 + Math.sin(particle.pulse) * 0.3);
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = particle.coreColor.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla');
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  const drawLensFlare = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, intensity: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    // Soft, subtle flare - much gentler
    const flareLength = size * 2.5 * intensity;
    const flareWidth = size * 0.15;
    
    // Very subtle cross flare
    ctx.strokeStyle = color.replace(')', `, ${0.12 * intensity})`).replace('hsl', 'hsla');
    ctx.lineWidth = flareWidth;
    ctx.lineCap = 'round';

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - flareLength, y);
    ctx.lineTo(x + flareLength, y);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - flareLength);
    ctx.lineTo(x, y + flareLength);
    ctx.stroke();

    // Diagonal lines (very subtle)
    ctx.strokeStyle = color.replace(')', `, ${0.06 * intensity})`).replace('hsl', 'hsla');
    ctx.lineWidth = flareWidth * 0.4;

    ctx.beginPath();
    ctx.moveTo(x - flareLength * 0.5, y - flareLength * 0.5);
    ctx.lineTo(x + flareLength * 0.5, y + flareLength * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + flareLength * 0.5, y - flareLength * 0.5);
    ctx.lineTo(x - flareLength * 0.5, y + flareLength * 0.5);
    ctx.stroke();

    // Soft central glow
    const pointGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.8);
    pointGradient.addColorStop(0, `hsla(0, 0%, 100%, ${0.5 * intensity})`);
    pointGradient.addColorStop(0.4, color.replace(')', `, ${0.2 * intensity})`).replace('hsl', 'hsla'));
    pointGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = pointGradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawShootingStar = useCallback((ctx: CanvasRenderingContext2D, star: ShootingStar) => {
    const lifeRatio = star.life / star.maxLife;
    const fadeIn = Math.min(star.life / 10, 1);
    const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
    const alpha = fadeIn * fadeOut;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Draw trail
    star.trail.forEach((point, i) => {
      const trailAlpha = (1 - i / star.trail.length) * alpha * 0.6;
      const trailSize = 3 * (1 - i / star.trail.length);
      
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, trailSize * 3
      );
      gradient.addColorStop(0, `hsla(0, 0%, 100%, ${trailAlpha})`);
      gradient.addColorStop(0.3, star.color.replace(')', `, ${trailAlpha * 0.6})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailSize * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Main star head
    const headGradient = ctx.createRadialGradient(
      star.x, star.y, 0,
      star.x, star.y, 8
    );
    headGradient.addColorStop(0, `hsla(0, 0%, 100%, ${alpha})`);
    headGradient.addColorStop(0.3, star.color.replace(')', `, ${alpha * 0.8})`).replace('hsl', 'hsla'));
    headGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const drawGravitationalThread = useCallback((ctx: CanvasRenderingContext2D, p1: NebulaParticle, p2: NebulaParticle, dist: number, time: number) => {
    const maxDist = 180;
    const alpha = (1 - dist / maxDist) * 0.25;
    
    // Determine which particle is larger (more massive)
    const larger = p1.size > p2.size ? p1 : p2;
    const smaller = p1.size > p2.size ? p2 : p1;

    // Calculate control point that curves toward the larger mass
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const pullStrength = 0.3;
    const ctrlX = midX + (larger.x - midX) * pullStrength;
    const ctrlY = midY + (larger.y - midY) * pullStrength;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Create gradient along the curve
    const gradient = ctx.createLinearGradient(smaller.x, smaller.y, larger.x, larger.y);
    gradient.addColorStop(0, smaller.coreColor.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla'));
    gradient.addColorStop(0.5, `hsla(185, 70%, 50%, ${alpha})`);
    gradient.addColorStop(1, larger.coreColor.replace(')', `, ${alpha * 0.8})`).replace('hsl', 'hsla'));

    // Draw curved connection
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.5 + (1 - dist / maxDist) * 1.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);
    ctx.stroke();

    // Animated pulse along the thread
    const pulsePos = (Math.sin(time * 0.003 + dist * 0.01) + 1) / 2;
    const pulseX = p1.x + (p2.x - p1.x) * pulsePos;
    const pulseY = p1.y + (p2.y - p1.y) * pulsePos;
    
    const pulseGradient = ctx.createRadialGradient(
      pulseX, pulseY, 0,
      pulseX, pulseY, 4
    );
    pulseGradient.addColorStop(0, `hsla(185, 70%, 70%, ${alpha * 1.5})`);
    pulseGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = pulseGradient;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const deltaTime = 1;

    // Update and spawn shooting stars
    const now = Date.now();
    if (now - lastShootingStarRef.current > 3000 + Math.random() * 5000) {
      shootingStarsRef.current.push(createShootingStar(canvas.width, canvas.height));
      lastShootingStarRef.current = now;
    }

    // Update shooting stars
    shootingStarsRef.current = shootingStarsRef.current.filter(star => {
      star.trail.unshift({ x: star.x, y: star.y, alpha: 1 });
      if (star.trail.length > 15) star.trail.pop();
      
      star.x += star.vx;
      star.y += star.vy;
      star.life++;
      
      return star.life < star.maxLife && 
             star.x > -50 && star.x < canvas.width + 50 &&
             star.y > -50 && star.y < canvas.height + 50;
    });

    // Draw gravitational threads first (behind particles)
    const nebulaParticles = particlesRef.current.filter(p => p.type === 'nebula');
    nebulaParticles.forEach((p1, i) => {
      nebulaParticles.slice(i + 1).forEach(p2 => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 180) {
          drawGravitationalThread(ctx, p1, p2, dist, time);
        }
      });
    });

    // Update and draw particles
    particlesRef.current.forEach(particle => {
      updateParticle(particle, canvas.width, canvas.height, deltaTime);

      switch (particle.type) {
        case 'nebula':
          drawNebulaCloud(ctx, particle);
          break;
        case 'star':
          drawStar(ctx, particle);
          break;
        case 'dust':
          drawDust(ctx, particle);
          break;
      }
    });

    // Draw shooting stars (on top)
    shootingStarsRef.current.forEach(star => {
      drawShootingStar(ctx, star);
    });

    animationRef.current = requestAnimationFrame(draw);
  }, [updateParticle, drawNebulaCloud, drawStar, drawDust, drawShootingStar, drawGravitationalThread, createShootingStar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      centerRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
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

  useEffect(() => {
    initParticles();
  }, [dataCount, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
}
