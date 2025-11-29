import { useEffect, useRef, useCallback } from 'react';

interface MilkyWayStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  colorTemp: number; // For realistic star distribution
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
}

interface DustLane {
  points: { x: number; y: number }[];
  width: number;
  opacity: number;
}

interface NebulaPatch {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
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

// Realistic stellar classification colors with weights
// O/B (hot blue) → A (blue-white) → F (white) → G (yellow-white) → K (orange) → M (red)
const stellarColors = [
  { color: 'hsl(210, 100%, 92%)', weight: 0.03, name: 'O/B' },   // Hot blue - rare, very bright
  { color: 'hsl(200, 80%, 90%)', weight: 0.07, name: 'A' },      // Blue-white
  { color: 'hsl(45, 15%, 96%)', weight: 0.12, name: 'F' },       // White
  { color: 'hsl(45, 35%, 88%)', weight: 0.20, name: 'G' },       // Yellow-white (Sun-like)
  { color: 'hsl(30, 55%, 78%)', weight: 0.30, name: 'K' },       // Orange - most common
  { color: 'hsl(15, 65%, 68%)', weight: 0.28, name: 'M' },       // Red - numerous but dim
];

// Nebula colors for patches
const nebulaPatchColors = [
  'hsl(280, 60%, 50%)',  // Purple
  'hsl(340, 50%, 45%)',  // Magenta/pink
  'hsl(185, 60%, 40%)',  // Cyan
  'hsl(200, 50%, 35%)',  // Blue
];

// Background star colors (scattered, dimmer)
const bgStarColors = [
  'hsl(210, 25%, 80%)',
  'hsl(200, 20%, 75%)',
  'hsl(45, 10%, 85%)',
  'hsl(35, 20%, 70%)',
  'hsl(0, 0%, 80%)',
];

// Select star color based on weighted distribution
const selectStarColor = (): { color: string; temp: number } => {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < stellarColors.length; i++) {
    cumulative += stellarColors[i].weight;
    if (rand < cumulative) {
      return { color: stellarColors[i].color, temp: i };
    }
  }
  return { color: stellarColors[4].color, temp: 4 }; // Default to K-type
};

export function ParticleBackground({ 
  particleCount = 40, 
  interactive = true,
  dataCount = 0 
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const milkyWayStarsRef = useRef<MilkyWayStar[]>([]);
  const backgroundStarsRef = useRef<BackgroundStar[]>([]);
  const dustLanesRef = useRef<DustLane[]>([]);
  const nebulaPatchesRef = useRef<NebulaPatch[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const lastShootingStarRef = useRef(0);

  // Create Milky Way stars concentrated in horizontal band
  const createMilkyWayStars = useCallback((width: number, height: number): MilkyWayStar[] => {
    const stars: MilkyWayStar[] = [];
    const starCount = 800;
    
    // Galaxy band parameters
    const bandCenterY = height * 0.45; // Slightly above center
    const bandWidth = height * 0.28;   // Width of the dense band
    
    for (let i = 0; i < starCount; i++) {
      // Gaussian-like distribution to concentrate stars in band
      // Using Box-Muller transform approximation
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussianOffset = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const y = bandCenterY + gaussianOffset * bandWidth * 0.5;
      
      // Spread stars evenly across full width (not biased to center since window blocks it)
      const x = Math.random() * width;
      
      // Distance from band center affects brightness
      const distFromBand = Math.abs(y - bandCenterY) / bandWidth;
      const bandAlphaMultiplier = 1 - Math.pow(distFromBand, 2) * 0.5;
      
      const starColor = selectStarColor();
      // Blue stars (low temp number) are brighter
      const tempBrightness = starColor.temp < 2 ? 1.5 : (starColor.temp < 4 ? 1.0 : 0.7);
      
      stars.push({
        x,
        y: Math.max(0, Math.min(height, y)),
        size: (Math.random() * 2.5 + 0.5) * (starColor.temp < 2 ? 1.6 : 1),
        alpha: (Math.random() * 0.6 + 0.4) * bandAlphaMultiplier * tempBrightness,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: starColor.color,
        colorTemp: starColor.temp,
      });
    }
    return stars;
  }, []);

  // Create scattered background stars (outside the main band)
  const createBackgroundStars = useCallback((width: number, height: number): BackgroundStar[] => {
    const stars: BackgroundStar[] = [];
    const starCount = 200; // Fewer, scattered everywhere
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.9 + 0.2,
        alpha: Math.random() * 0.25 + 0.05,
        twinkleSpeed: Math.random() * 0.01 + 0.003,
        twinklePhase: Math.random() * Math.PI * 2,
        color: bgStarColors[Math.floor(Math.random() * bgStarColors.length)],
      });
    }
    return stars;
  }, []);

  // Create dark dust lanes that weave through the galaxy band
  const createDustLanes = useCallback((width: number, height: number): DustLane[] => {
    const lanes: DustLane[] = [];
    const bandCenterY = height * 0.45;
    const laneCount = 4;
    
    for (let i = 0; i < laneCount; i++) {
      const points: { x: number; y: number }[] = [];
      const baseY = bandCenterY + (i - laneCount / 2 + 0.5) * (height * 0.06);
      const waveAmplitude = 20 + Math.random() * 30;
      const waveFreq = 0.003 + Math.random() * 0.002;
      const phase = Math.random() * Math.PI * 2;
      
      // Generate serpentine path across screen
      for (let x = -100; x <= width + 100; x += 60) {
        const waveY = Math.sin(x * waveFreq + phase) * waveAmplitude;
        const secondaryWave = Math.sin(x * waveFreq * 2.5 + phase * 1.5) * waveAmplitude * 0.3;
        points.push({
          x,
          y: baseY + waveY + secondaryWave
        });
      }
      
      lanes.push({
        points,
        width: 12 + Math.random() * 20,
        opacity: 0.25 + Math.random() * 0.25
      });
    }
    return lanes;
  }, []);

  // Create subtle nebula patches within the galaxy band
  const createNebulae = useCallback((width: number, height: number): NebulaPatch[] => {
    const patches: NebulaPatch[] = [];
    const bandCenterY = height * 0.45;
    const bandWidth = height * 0.3;
    const patchCount = 8;
    
    for (let i = 0; i < patchCount; i++) {
      const y = bandCenterY + (Math.random() - 0.5) * bandWidth;
      const x = Math.random() * width;
      
      patches.push({
        x,
        y,
        size: Math.random() * 50 + 25,
        color: nebulaPatchColors[Math.floor(Math.random() * nebulaPatchColors.length)],
        alpha: Math.random() * 0.12 + 0.04,
        rotation: Math.random() * Math.PI * 2,
      });
    }
    return patches;
  }, []);

  const createShootingStar = useCallback((width: number, height: number): ShootingStar => {
    const startEdge = Math.floor(Math.random() * 4);
    let x: number, y: number, vx: number, vy: number;
    const speed = 7 + Math.random() * 5;
    
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
      maxLife: 70 + Math.random() * 40,
      trail: [],
      color: stellarColors[Math.floor(Math.random() * 3)].color,
    };
  }, []);

  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    milkyWayStarsRef.current = createMilkyWayStars(canvas.width, canvas.height);
    backgroundStarsRef.current = createBackgroundStars(canvas.width, canvas.height);
    dustLanesRef.current = createDustLanes(canvas.width, canvas.height);
    nebulaPatchesRef.current = createNebulae(canvas.width, canvas.height);
    shootingStarsRef.current = [];
  }, [createMilkyWayStars, createBackgroundStars, createDustLanes, createNebulae]);

  // Draw galactic core glow
  const drawGalacticCore = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, parallaxX: number, parallaxY: number) => {
    const coreX = width * 0.5 + parallaxX * 20;
    const coreY = height * 0.45 + parallaxY * 20;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    // Outer warm glow
    const outerGlow = ctx.createRadialGradient(
      coreX, coreY, 0,
      coreX, coreY, width * 0.35
    );
    outerGlow.addColorStop(0, 'hsla(40, 80%, 70%, 0.12)');
    outerGlow.addColorStop(0.2, 'hsla(35, 70%, 60%, 0.08)');
    outerGlow.addColorStop(0.5, 'hsla(30, 60%, 50%, 0.04)');
    outerGlow.addColorStop(0.8, 'hsla(25, 50%, 40%, 0.01)');
    outerGlow.addColorStop(1, 'transparent');
    
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, width, height);
    
    // Inner bright core
    const innerGlow = ctx.createRadialGradient(
      coreX, coreY, 0,
      coreX, coreY, width * 0.15
    );
    innerGlow.addColorStop(0, 'hsla(45, 90%, 85%, 0.15)');
    innerGlow.addColorStop(0.3, 'hsla(40, 80%, 70%, 0.08)');
    innerGlow.addColorStop(0.7, 'hsla(35, 60%, 55%, 0.03)');
    innerGlow.addColorStop(1, 'transparent');
    
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, width, height);
    
    ctx.restore();
  }, []);

  // Draw dark dust lanes
  const drawDustLanes = useCallback((ctx: CanvasRenderingContext2D, parallaxX: number, parallaxY: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    
    dustLanesRef.current.forEach(lane => {
      if (lane.points.length < 2) return;
      
      ctx.strokeStyle = `rgba(5, 5, 15, ${lane.opacity})`;
      ctx.lineWidth = lane.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      const offsetX = parallaxX * 15;
      const offsetY = parallaxY * 15;
      
      ctx.moveTo(lane.points[0].x + offsetX, lane.points[0].y + offsetY);
      
      for (let i = 1; i < lane.points.length - 1; i++) {
        const p0 = lane.points[i - 1];
        const p1 = lane.points[i];
        const midX = (p0.x + p1.x) / 2 + offsetX;
        const midY = (p0.y + p1.y) / 2 + offsetY;
        ctx.quadraticCurveTo(p0.x + offsetX, p0.y + offsetY, midX, midY);
      }
      
      const last = lane.points[lane.points.length - 1];
      ctx.lineTo(last.x + offsetX, last.y + offsetY);
      ctx.stroke();
    });
    
    ctx.restore();
  }, []);

  // Draw scattered background stars
  const drawBackgroundStars = useCallback((ctx: CanvasRenderingContext2D, time: number, parallaxX: number, parallaxY: number) => {
    backgroundStarsRef.current.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 8;
      const offsetY = parallaxY * 8;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2);
      gradient.addColorStop(0, star.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
      gradient.addColorStop(0.6, star.color.replace(')', `, ${alpha * 0.2})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }, []);

  // Draw Milky Way band stars
  const drawMilkyWayStars = useCallback((ctx: CanvasRenderingContext2D, time: number, parallaxX: number, parallaxY: number) => {
    milkyWayStarsRef.current.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      const twinkle = Math.sin(star.twinklePhase) * 0.25 + 0.75;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 25;
      const offsetY = parallaxY * 25;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      // Draw glow for brighter stars (hot blue and white)
      if (star.colorTemp < 3 && star.alpha > 0.4) {
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 4);
        glowGradient.addColorStop(0, star.color.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla'));
        glowGradient.addColorStop(0.4, star.color.replace(')', `, ${alpha * 0.15})`).replace('hsl', 'hsla'));
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Core point
      const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 1.5);
      coreGradient.addColorStop(0, star.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
      coreGradient.addColorStop(0.5, star.color.replace(')', `, ${alpha * 0.4})`).replace('hsl', 'hsla'));
      coreGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }, []);

  // Draw nebula patches
  const drawNebulae = useCallback((ctx: CanvasRenderingContext2D, parallaxX: number, parallaxY: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    nebulaPatchesRef.current.forEach(patch => {
      const offsetX = parallaxX * 18;
      const offsetY = parallaxY * 18;
      const x = patch.x + offsetX;
      const y = patch.y + offsetY;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, patch.size);
      gradient.addColorStop(0, patch.color.replace(')', `, ${patch.alpha})`).replace('hsl', 'hsla'));
      gradient.addColorStop(0.4, patch.color.replace(')', `, ${patch.alpha * 0.4})`).replace('hsl', 'hsla'));
      gradient.addColorStop(0.7, patch.color.replace(')', `, ${patch.alpha * 0.1})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, patch.size, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.restore();
  }, []);

  // Draw shooting stars
  const drawShootingStar = useCallback((ctx: CanvasRenderingContext2D, star: ShootingStar) => {
    const lifeRatio = star.life / star.maxLife;
    const fadeIn = Math.min(star.life / 10, 1);
    const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1;
    const alpha = fadeIn * fadeOut;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Trail
    star.trail.forEach((point, i) => {
      const trailAlpha = (1 - i / star.trail.length) * alpha * 0.5;
      const trailSize = 2.5 * (1 - i / star.trail.length);
      
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, trailSize * 3);
      gradient.addColorStop(0, `hsla(0, 0%, 100%, ${trailAlpha})`);
      gradient.addColorStop(0.4, star.color.replace(')', `, ${trailAlpha * 0.5})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, trailSize * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Head
    const headGradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 6);
    headGradient.addColorStop(0, `hsla(0, 0%, 100%, ${alpha})`);
    headGradient.addColorStop(0.4, star.color.replace(')', `, ${alpha * 0.7})`).replace('hsl', 'hsla'));
    headGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  // Draw vignette overlay
  const drawVignette = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.15,
      width / 2, height / 2, Math.max(width, height) * 0.85
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.4, 'transparent');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear with deep space black
    ctx.fillStyle = 'hsl(230, 30%, 3%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth mouse tracking for parallax
    smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.04;
    smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.04;
    
    // Calculate parallax offset from center
    const parallaxX = (smoothMouseRef.current.x - canvas.width / 2) / canvas.width;
    const parallaxY = (smoothMouseRef.current.y - canvas.height / 2) / canvas.height;

    // Spawn shooting stars
    const now = Date.now();
    if (now - lastShootingStarRef.current > 4000 + Math.random() * 6000) {
      shootingStarsRef.current.push(createShootingStar(canvas.width, canvas.height));
      lastShootingStarRef.current = now;
    }

    // Update shooting stars
    shootingStarsRef.current = shootingStarsRef.current.filter(star => {
      star.trail.unshift({ x: star.x, y: star.y, alpha: 1 });
      if (star.trail.length > 12) star.trail.pop();
      
      star.x += star.vx;
      star.y += star.vy;
      star.life++;
      
      return star.life < star.maxLife && 
             star.x > -50 && star.x < canvas.width + 50 &&
             star.y > -50 && star.y < canvas.height + 50;
    });

    // DRAW ORDER (back to front):
    
    // 1. Galactic core glow (furthest back)
    drawGalacticCore(ctx, canvas.width, canvas.height, parallaxX, parallaxY);
    
    // 2. Scattered background stars (outside main band)
    drawBackgroundStars(ctx, time, parallaxX, parallaxY);
    
    // 3. Dark dust lanes (weaving through band)
    drawDustLanes(ctx, parallaxX, parallaxY);
    
    // 4. Milky Way band stars (main feature)
    drawMilkyWayStars(ctx, time, parallaxX, parallaxY);
    
    // 5. Nebula patches (colorful emission nebulae)
    drawNebulae(ctx, parallaxX, parallaxY);
    
    // 6. Shooting stars (foreground)
    shootingStarsRef.current.forEach(star => {
      drawShootingStar(ctx, star);
    });
    
    // 7. Vignette (top layer)
    drawVignette(ctx, canvas.width, canvas.height);

    animationRef.current = requestAnimationFrame(draw);
  }, [drawGalacticCore, drawBackgroundStars, drawDustLanes, drawMilkyWayStars, drawNebulae, drawShootingStar, drawVignette, createShootingStar]);

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
      style={{ opacity: 1 }}
    />
  );
}
