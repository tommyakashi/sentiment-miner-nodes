import { useEffect, useRef, useCallback } from 'react';

interface NebulaParticle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
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
  depth: number; // 0 = far (slow parallax), 1 = close (fast parallax)
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  depth: number;
  color: string;
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

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
  dataCount?: number;
}

// Nebula colors (vibrant for nebulae)
const nebulaColors = [
  { core: 'hsl(280, 70%, 60%)', outer: 'hsl(260, 50%, 30%)' },
  { core: 'hsl(185, 70%, 50%)', outer: 'hsl(200, 50%, 25%)' },
  { core: 'hsl(340, 70%, 55%)', outer: 'hsl(320, 40%, 25%)' },
  { core: 'hsl(45, 80%, 55%)', outer: 'hsl(30, 60%, 30%)' },
  { core: 'hsl(160, 65%, 50%)', outer: 'hsl(140, 40%, 25%)' },
];

// Natural star color temperatures (realistic astronomy colors)
const starTemperatureColors = [
  { core: 'hsl(210, 80%, 95%)', outer: 'hsl(210, 60%, 70%)' },
  { core: 'hsl(200, 50%, 90%)', outer: 'hsl(200, 40%, 65%)' },
  { core: 'hsl(45, 10%, 98%)', outer: 'hsl(45, 8%, 80%)' },
  { core: 'hsl(45, 30%, 92%)', outer: 'hsl(45, 25%, 75%)' },
  { core: 'hsl(35, 60%, 80%)', outer: 'hsl(35, 50%, 60%)' },
  { core: 'hsl(15, 70%, 70%)', outer: 'hsl(15, 60%, 50%)' },
];

// Background star colors (dim, natural)
const bgStarColors = [
  'hsl(210, 30%, 85%)',
  'hsl(200, 20%, 80%)',
  'hsl(45, 15%, 90%)',
  'hsl(35, 25%, 75%)',
  'hsl(15, 30%, 70%)',
  'hsl(0, 0%, 85%)',
];

export function ParticleBackground({ 
  particleCount = 40, 
  interactive = true,
  dataCount = 0 
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<NebulaParticle[]>([]);
  const backgroundStarsRef = useRef<BackgroundStar[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const centerRef = useRef({ x: 0, y: 0 });
  const lastShootingStarRef = useRef(0);

  // Create dense background starfield
  const createBackgroundStars = useCallback((width: number, height: number): BackgroundStar[] => {
    const stars: BackgroundStar[] = [];
    const starCount = 300; // Dense starfield
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.2 + 0.3, // Tiny stars
        alpha: Math.random() * 0.4 + 0.1,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: Math.random() * 0.3, // Far away (slow parallax)
        color: bgStarColors[Math.floor(Math.random() * bgStarColors.length)],
      });
    }
    return stars;
  }, []);

  const createNebulaParticle = useCallback((width: number, height: number): NebulaParticle => {
    const centerX = width / 2;
    const centerY = height / 2;
    const angle = Math.random() * Math.PI * 2;
    // Increased spread to fill more of the screen
    const maxRadius = Math.max(width, height) * 0.6;
    const radius = Math.random() * maxRadius + 30;
    
    const isNebula = Math.random() > 0.55;
    const isStar = !isNebula && Math.random() > 0.4;
    
    const colorSet = isStar 
      ? starTemperatureColors[Math.floor(Math.random() * starTemperatureColors.length)]
      : nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
    
    // Depth: nebulae are far (0.1-0.3), stars closer (0.4-0.8), dust mid (0.2-0.5)
    const depth = isNebula 
      ? Math.random() * 0.2 + 0.1 
      : isStar 
        ? Math.random() * 0.4 + 0.4 
        : Math.random() * 0.3 + 0.2;

    const baseX = centerX + Math.cos(angle) * radius;
    const baseY = centerY + Math.sin(angle) * radius;
    
    return {
      x: baseX,
      y: baseY,
      baseX,
      baseY,
      angle,
      radius,
      angularVelocity: (0.0002 + Math.random() * 0.0006) * (Math.random() > 0.5 ? 1 : -1) * (1 - radius / maxRadius * 0.5),
      radialDrift: (Math.random() - 0.5) * 0.03,
      size: isNebula ? Math.random() * 70 + 30 : isStar ? Math.random() * 3 + 1.5 : Math.random() * 2 + 1,
      coreColor: colorSet.core,
      outerColor: colorSet.outer,
      alpha: isNebula ? Math.random() * 0.2 + 0.08 : Math.random() * 0.5 + 0.25,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.02 + 0.008,
      twinklePhase: Math.random() * Math.PI * 2,
      trail: [],
      type: isNebula ? 'nebula' : isStar ? 'star' : 'dust',
      hasFlare: isNebula && Math.random() > 0.75,
      depth,
    };
  }, []);

  const createShootingStar = useCallback((width: number, height: number): ShootingStar => {
    const startEdge = Math.floor(Math.random() * 4);
    let x: number, y: number, vx: number, vy: number;
    const speed = 8 + Math.random() * 6;
    
    switch (startEdge) {
      case 0:
        x = Math.random() * width;
        y = -10;
        vx = (Math.random() - 0.5) * speed;
        vy = speed;
        break;
      case 1:
        x = width + 10;
        y = Math.random() * height;
        vx = -speed;
        vy = (Math.random() - 0.5) * speed;
        break;
      case 2:
        x = Math.random() * width;
        y = height + 10;
        vx = (Math.random() - 0.5) * speed;
        vy = -speed;
        break;
      default:
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
    const count = Math.min(particleCount + Math.floor(dataCount / 15), 90);
    particlesRef.current = Array.from({ length: count }, () => 
      createNebulaParticle(canvas.width, canvas.height)
    );
    backgroundStarsRef.current = createBackgroundStars(canvas.width, canvas.height);
    shootingStarsRef.current = [];
  }, [particleCount, dataCount, createNebulaParticle, createBackgroundStars]);

  const updateParticle = useCallback((particle: NebulaParticle, width: number, height: number, deltaTime: number) => {
    const centerX = centerRef.current.x;
    const centerY = centerRef.current.y;

    particle.angle += particle.angularVelocity * deltaTime;
    particle.radius += particle.radialDrift * deltaTime * 0.1;
    
    const maxRadius = Math.max(width, height) * 0.6;
    if (particle.radius > maxRadius) {
      particle.radialDrift = -Math.abs(particle.radialDrift);
    } else if (particle.radius < 30) {
      particle.radialDrift = Math.abs(particle.radialDrift);
    }

    particle.baseX = centerX + Math.cos(particle.angle) * particle.radius;
    particle.baseY = centerY + Math.sin(particle.angle) * particle.radius;

    if (particle.type !== 'dust') {
      particle.trail.unshift({ x: particle.x, y: particle.y, alpha: particle.alpha });
      if (particle.trail.length > 8) particle.trail.pop();
    }

    particle.pulse += particle.pulseSpeed * deltaTime;
    particle.twinklePhase += 0.05 * deltaTime;
  }, []);

  // Draw background starfield with parallax
  const drawBackgroundStars = useCallback((ctx: CanvasRenderingContext2D, time: number, parallaxX: number, parallaxY: number) => {
    backgroundStarsRef.current.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.alpha * twinkle;
      
      // Parallax offset based on depth
      const offsetX = parallaxX * star.depth * 15;
      const offsetY = parallaxY * star.depth * 15;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      // Simple point star with subtle glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2);
      gradient.addColorStop(0, star.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
      gradient.addColorStop(0.5, star.color.replace(')', `, ${alpha * 0.3})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }, []);

  const drawNebulaCloud = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle, parallaxX: number, parallaxY: number) => {
    const pulseAlpha = particle.alpha + Math.sin(particle.pulse) * 0.08;
    const pulseSize = particle.size + Math.sin(particle.pulse * 0.5) * particle.size * 0.15;
    const twinkle = Math.sin(particle.twinklePhase) * 0.5 + 0.5;

    // Apply parallax based on depth
    const offsetX = parallaxX * particle.depth * 40;
    const offsetY = parallaxY * particle.depth * 40;
    const x = particle.baseX + offsetX;
    const y = particle.baseY + offsetY;
    particle.x = x;
    particle.y = y;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Draw trail
    particle.trail.forEach((point, i) => {
      const trailAlpha = (1 - i / particle.trail.length) * pulseAlpha * 0.3;
      const trailSize = pulseSize * (1 - i / particle.trail.length * 0.5);
      
      const trailGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, trailSize);
      trailGradient.addColorStop(0, particle.outerColor.replace(')', `, ${trailAlpha * 0.3})`).replace('hsl', 'hsla'));
      trailGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = trailGradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Outer nebula glow
    const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, pulseSize * 1.5);
    outerGradient.addColorStop(0, particle.outerColor.replace(')', `, ${pulseAlpha * 0.4})`).replace('hsl', 'hsla'));
    outerGradient.addColorStop(0.5, particle.outerColor.replace(')', `, ${pulseAlpha * 0.2})`).replace('hsl', 'hsla'));
    outerGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(x, y, pulseSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core nebula
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, pulseSize);
    coreGradient.addColorStop(0, particle.coreColor.replace(')', `, ${pulseAlpha * 0.6 * twinkle})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(0.4, particle.coreColor.replace(')', `, ${pulseAlpha * 0.3})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
    ctx.fill();

    // Lens flare
    if (particle.hasFlare && twinkle > 0.7) {
      drawLensFlare(ctx, x, y, pulseSize * 0.3, particle.coreColor, twinkle);
    }

    ctx.restore();
  }, []);

  const drawStar = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle, parallaxX: number, parallaxY: number) => {
    const twinkle = Math.sin(particle.twinklePhase * 2) * 0.3 + 0.7;
    const size = particle.size * twinkle;
    const alpha = particle.alpha * twinkle;

    // Apply parallax - stars move more (higher depth)
    const offsetX = parallaxX * particle.depth * 40;
    const offsetY = parallaxY * particle.depth * 40;
    const x = particle.baseX + offsetX;
    const y = particle.baseY + offsetY;
    particle.x = x;
    particle.y = y;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Soft outer glow
    const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
    outerGlow.addColorStop(0, particle.outerColor.replace(')', `, ${alpha * 0.6})`).replace('hsl', 'hsla'));
    outerGlow.addColorStop(0.5, particle.outerColor.replace(')', `, ${alpha * 0.2})`).replace('hsl', 'hsla'));
    outerGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.8);
    coreGradient.addColorStop(0, particle.coreColor.replace(')', `, ${alpha * 0.9})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(0.6, particle.coreColor.replace(')', `, ${alpha * 0.4})`).replace('hsl', 'hsla'));
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  const drawDust = useCallback((ctx: CanvasRenderingContext2D, particle: NebulaParticle, parallaxX: number, parallaxY: number) => {
    const alpha = particle.alpha * (0.5 + Math.sin(particle.pulse) * 0.3);
    
    const offsetX = parallaxX * particle.depth * 40;
    const offsetY = parallaxY * particle.depth * 40;
    const x = particle.baseX + offsetX;
    const y = particle.baseY + offsetY;
    particle.x = x;
    particle.y = y;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = particle.coreColor.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla');
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  const drawLensFlare = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, intensity: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    const flareLength = size * 2.5 * intensity;
    const flareWidth = size * 0.15;
    
    ctx.strokeStyle = color.replace(')', `, ${0.12 * intensity})`).replace('hsl', 'hsla');
    ctx.lineWidth = flareWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x - flareLength, y);
    ctx.lineTo(x + flareLength, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - flareLength);
    ctx.lineTo(x, y + flareLength);
    ctx.stroke();

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

    star.trail.forEach((point, i) => {
      const trailAlpha = (1 - i / star.trail.length) * alpha * 0.6;
      const trailSize = 3 * (1 - i / star.trail.length);
      
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, trailSize * 3);
      gradient.addColorStop(0, `hsla(0, 0%, 100%, ${trailAlpha})`);
      gradient.addColorStop(0.3, star.color.replace(')', `, ${trailAlpha * 0.6})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailSize * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const headGradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 8);
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
    
    const larger = p1.size > p2.size ? p1 : p2;
    const smaller = p1.size > p2.size ? p2 : p1;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const pullStrength = 0.3;
    const ctrlX = midX + (larger.x - midX) * pullStrength;
    const ctrlY = midY + (larger.y - midY) * pullStrength;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const gradient = ctx.createLinearGradient(smaller.x, smaller.y, larger.x, larger.y);
    gradient.addColorStop(0, smaller.coreColor.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla'));
    gradient.addColorStop(0.5, `hsla(185, 70%, 50%, ${alpha})`);
    gradient.addColorStop(1, larger.coreColor.replace(')', `, ${alpha * 0.8})`).replace('hsl', 'hsla'));

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.5 + (1 - dist / maxDist) * 1.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);
    ctx.stroke();

    const pulsePos = (Math.sin(time * 0.003 + dist * 0.01) + 1) / 2;
    const pulseX = p1.x + (p2.x - p1.x) * pulsePos;
    const pulseY = p1.y + (p2.y - p1.y) * pulsePos;
    
    const pulseGradient = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 4);
    pulseGradient.addColorStop(0, `hsla(185, 70%, 70%, ${alpha * 1.5})`);
    pulseGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = pulseGradient;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // Draw vignette overlay
  const drawVignette = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.2,
      width / 2, height / 2, Math.max(width, height) * 0.8
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, 'transparent');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth mouse tracking for parallax
    smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.05;
    smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.05;
    
    // Calculate parallax offset from center
    const parallaxX = (smoothMouseRef.current.x - canvas.width / 2) / canvas.width;
    const parallaxY = (smoothMouseRef.current.y - canvas.height / 2) / canvas.height;

    const deltaTime = 1;

    // Spawn shooting stars
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

    // Draw background starfield first (furthest layer)
    drawBackgroundStars(ctx, time, parallaxX, parallaxY);

    // Draw gravitational threads
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

    // Update and draw particles with parallax
    particlesRef.current.forEach(particle => {
      updateParticle(particle, canvas.width, canvas.height, deltaTime);

      switch (particle.type) {
        case 'nebula':
          drawNebulaCloud(ctx, particle, parallaxX, parallaxY);
          break;
        case 'star':
          drawStar(ctx, particle, parallaxX, parallaxY);
          break;
        case 'dust':
          drawDust(ctx, particle, parallaxX, parallaxY);
          break;
      }
    });

    // Draw shooting stars on top
    shootingStarsRef.current.forEach(star => {
      drawShootingStar(ctx, star);
    });

    // Draw vignette overlay (on top of everything)
    drawVignette(ctx, canvas.width, canvas.height);

    animationRef.current = requestAnimationFrame(draw);
  }, [updateParticle, drawBackgroundStars, drawNebulaCloud, drawStar, drawDust, drawShootingStar, drawGravitationalThread, createShootingStar, drawVignette]);

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
    // Initialize smooth mouse at center
    smoothMouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    
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
      style={{ opacity: 0.9 }}
    />
  );
}
