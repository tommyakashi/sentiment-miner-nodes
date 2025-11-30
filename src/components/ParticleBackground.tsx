import { useEffect, useRef, useCallback } from 'react';

interface MilkyWayStar {
  x: number;
  y: number;
  baseX: number; // Original position for drift animation
  baseY: number;
  vx: number; // Drift velocity
  vy: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftPhase: number; // For smooth oscillating movement
  driftSpeed: number;
  color: string;
  colorTemp: number;
}

interface BackgroundStar {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftPhase: number;
  driftSpeed: number;
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
  spiralActive?: boolean;
}

// Scientifically accurate stellar classification colors based on blackbody temperature
// O-type (>30,000K) → B-type (10,000-30,000K) → A-type (7,500-10,000K) → F-type (6,000-7,500K) → G-type (5,200-6,000K) → K-type (3,700-5,200K) → M-type (<3,700K)
const stellarColors = [
  { color: 'hsl(220, 70%, 85%)', weight: 0.02, name: 'O' },      // O-type: Very hot blue - extremely rare
  { color: 'hsl(215, 55%, 88%)', weight: 0.05, name: 'B' },      // B-type: Hot blue-white
  { color: 'hsl(210, 35%, 92%)', weight: 0.10, name: 'A' },      // A-type: White with blue tinge (Sirius, Vega)
  { color: 'hsl(45, 8%, 95%)', weight: 0.15, name: 'F' },        // F-type: Pale yellow-white (Procyon)
  { color: 'hsl(45, 30%, 90%)', weight: 0.18, name: 'G' },       // G-type: Yellow (Sun-like)
  { color: 'hsl(35, 60%, 80%)', weight: 0.25, name: 'K' },       // K-type: Orange (Arcturus) - very common
  { color: 'hsl(25, 75%, 65%)', weight: 0.25, name: 'M' },       // M-type: Red-orange (Betelgeuse) - most common but dim
];

// Nebula colors for patches
const nebulaPatchColors = [
  'hsl(280, 60%, 50%)',  // Purple
  'hsl(340, 50%, 45%)',  // Magenta/pink
  'hsl(185, 60%, 40%)',  // Cyan
  'hsl(200, 50%, 35%)',  // Blue
];

// Background star colors (scattered, dimmer) - scientifically accurate
const bgStarColors = [
  'hsl(210, 35%, 85%)',   // A-type white-blue
  'hsl(45, 8%, 88%)',     // F-type pale white
  'hsl(45, 25%, 85%)',    // G-type warm white
  'hsl(35, 45%, 75%)',    // K-type orange tint
  'hsl(220, 15%, 82%)',   // Cool white
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
  dataCount = 0,
  spiralActive = false
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
  const spiralProgressRef = useRef(0);
  const spiralActiveRef = useRef(false);
  const starOriginalPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const spiralTargetPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Create Milky Way stars in a diagonal sweeping band like the real galaxy
  const createMilkyWayStars = useCallback((width: number, height: number): MilkyWayStar[] => {
    const stars: MilkyWayStar[] = [];
    const starCount = 1200;
    const bulgeStarCount = 400; // Extra stars for galactic bulge
    
    // Galaxy band parameters - diagonal sweep from top-left to bottom-right
    const bandWidth = height * 0.5;
    
    // Regular band stars
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * width;
      const xRatio = x / width;
      const diagonalY = height * 0.2 + xRatio * height * 0.6;
      const curveOffset = Math.sin(xRatio * Math.PI) * height * 0.08;
      const bandCenterAtX = diagonalY + curveOffset;
      
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussianOffset = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const y = bandCenterAtX + gaussianOffset * bandWidth * 0.35;
      
      const distFromBand = Math.abs(y - bandCenterAtX) / bandWidth;
      const bandAlphaMultiplier = 1 - Math.pow(distFromBand, 2) * 0.4;
      
      const starColor = selectStarColor();
      const tempBrightness = starColor.temp < 2 ? 1.5 : (starColor.temp < 4 ? 1.0 : 0.7);
      
      stars.push({
        x,
        y: Math.max(0, Math.min(height, y)),
        baseX: x,
        baseY: Math.max(0, Math.min(height, y)),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: (Math.random() * 2.5 + 0.5) * (starColor.temp < 2 ? 1.6 : 1),
        alpha: (Math.random() * 0.6 + 0.4) * bandAlphaMultiplier * tempBrightness,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.008 + 0.003,
        color: starColor.color,
        colorTemp: starColor.temp,
      });
    }
    
    // Galactic bulge - dense cluster of stars near the center
    const bulgeCenterX = width * 0.5;
    const bulgeCenterY = height * 0.2 + 0.5 * height * 0.6 + Math.sin(0.5 * Math.PI) * height * 0.08;
    const bulgeRadiusX = width * 0.2;
    const bulgeRadiusY = height * 0.18;
    
    for (let i = 0; i < bulgeStarCount; i++) {
      // Use 2D Gaussian for elliptical bulge
      const u1 = Math.random();
      const u2 = Math.random();
      const g1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const g2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
      
      const x = bulgeCenterX + g1 * bulgeRadiusX * 0.5;
      const y = bulgeCenterY + g2 * bulgeRadiusY * 0.5;
      
      // Bulge stars are warmer colors (older stars)
      const bulgeColors = [stellarColors[3], stellarColors[4], stellarColors[5]]; // G, K, M types
      const starColor = bulgeColors[Math.floor(Math.random() * bulgeColors.length)];
      
      // Distance from bulge center for brightness falloff
      const distFromCenter = Math.sqrt(
        Math.pow((x - bulgeCenterX) / bulgeRadiusX, 2) + 
        Math.pow((y - bulgeCenterY) / bulgeRadiusY, 2)
      );
      const bulgeAlpha = Math.max(0.3, 1 - distFromCenter * 0.6);
      
      stars.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 0.8,
        alpha: (Math.random() * 0.5 + 0.4) * bulgeAlpha,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.006 + 0.002,
        color: starColor.color,
        colorTemp: stellarColors.indexOf(starColor),
      });
    }
    
    return stars;
  }, []);

  // Create scattered background stars (outside the main band)
  const createBackgroundStars = useCallback((width: number, height: number): BackgroundStar[] => {
    const stars: BackgroundStar[] = [];
    const starCount = 250;
    
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      stars.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size: Math.random() * 1.2 + 0.3,
        alpha: Math.random() * 0.3 + 0.08,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.004 + 0.001,
        color: bgStarColors[Math.floor(Math.random() * bgStarColors.length)],
      });
    }
    return stars;
  }, []);

  // Create dark dust lanes that weave through the diagonal galaxy band
  const createDustLanes = useCallback((width: number, height: number): DustLane[] => {
    const lanes: DustLane[] = [];
    const laneCount = 5;
    
    for (let i = 0; i < laneCount; i++) {
      const points: { x: number; y: number }[] = [];
      const laneOffset = (i - laneCount / 2 + 0.5) * (height * 0.05);
      const waveAmplitude = 25 + Math.random() * 35;
      const waveFreq = 0.004 + Math.random() * 0.003;
      const phase = Math.random() * Math.PI * 2;
      
      // Generate serpentine path following the diagonal band
      for (let x = -100; x <= width + 100; x += 50) {
        const xRatio = x / width;
        // Follow the diagonal band center
        const diagonalY = height * 0.2 + xRatio * height * 0.6;
        const curveOffset = Math.sin(xRatio * Math.PI) * height * 0.08;
        const bandCenterAtX = diagonalY + curveOffset;
        
        const waveY = Math.sin(x * waveFreq + phase) * waveAmplitude;
        const secondaryWave = Math.sin(x * waveFreq * 2.5 + phase * 1.5) * waveAmplitude * 0.3;
        points.push({
          x,
          y: bandCenterAtX + laneOffset + waveY + secondaryWave
        });
      }
      
      lanes.push({
        points,
        width: 15 + Math.random() * 25,
        opacity: 0.2 + Math.random() * 0.25
      });
    }
    return lanes;
  }, []);

  // Create subtle nebula patches along the diagonal galaxy band
  const createNebulae = useCallback((width: number, height: number): NebulaPatch[] => {
    const patches: NebulaPatch[] = [];
    const bandWidth = height * 0.4;
    const patchCount = 12;
    
    for (let i = 0; i < patchCount; i++) {
      const x = Math.random() * width;
      const xRatio = x / width;
      // Follow the diagonal band
      const diagonalY = height * 0.2 + xRatio * height * 0.6;
      const curveOffset = Math.sin(xRatio * Math.PI) * height * 0.08;
      const bandCenterAtX = diagonalY + curveOffset;
      const y = bandCenterAtX + (Math.random() - 0.5) * bandWidth;
      
      patches.push({
        x,
        y,
        size: Math.random() * 60 + 30,
        color: nebulaPatchColors[Math.floor(Math.random() * nebulaPatchColors.length)],
        alpha: Math.random() * 0.15 + 0.05,
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

  // Draw galactic core glow - positioned along the diagonal band
  const drawGalacticCore = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, parallaxX: number, parallaxY: number) => {
    // Core at center of diagonal band (at x=0.5, y follows diagonal formula)
    const coreX = width * 0.5 + parallaxX * 20;
    const coreY = height * 0.2 + 0.5 * height * 0.6 + Math.sin(0.5 * Math.PI) * height * 0.08 + parallaxY * 20;
    
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
      // Update phases
      star.twinklePhase += star.twinkleSpeed;
      star.driftPhase += star.driftSpeed;
      
      // Only apply drift when NOT spiraling
      if (spiralProgressRef.current === 0) {
        const driftX = Math.sin(star.driftPhase) * 8;
        const driftY = Math.cos(star.driftPhase * 0.7) * 6;
        star.x = star.baseX + driftX;
        star.y = star.baseY + driftY;
      }
      
      const twinkle = Math.sin(star.twinklePhase) * 0.4 + 0.6;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 8;
      const offsetY = parallaxY * 8;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2.5);
      gradient.addColorStop(0, star.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
      gradient.addColorStop(0.5, star.color.replace(')', `, ${alpha * 0.3})`).replace('hsl', 'hsla'));
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }, []);

  // Draw Milky Way band stars
  const drawMilkyWayStars = useCallback((ctx: CanvasRenderingContext2D, time: number, parallaxX: number, parallaxY: number) => {
    milkyWayStarsRef.current.forEach(star => {
      // Update phases
      star.twinklePhase += star.twinkleSpeed;
      star.driftPhase += star.driftSpeed;
      
      // Only apply drift when NOT spiraling
      if (spiralProgressRef.current === 0) {
        const driftX = Math.sin(star.driftPhase) * 12 + Math.sin(star.driftPhase * 1.5) * 5;
        const driftY = Math.cos(star.driftPhase * 0.8) * 10 + Math.cos(star.driftPhase * 1.3) * 4;
        star.x = star.baseX + driftX;
        star.y = star.baseY + driftY;
      }
      
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 25;
      const offsetY = parallaxY * 25;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      // Draw glow for brighter stars (hot blue and white)
      if (star.colorTemp < 3 && star.alpha > 0.4) {
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 5);
        glowGradient.addColorStop(0, star.color.replace(')', `, ${alpha * 0.6})`).replace('hsl', 'hsla'));
        glowGradient.addColorStop(0.3, star.color.replace(')', `, ${alpha * 0.2})`).replace('hsl', 'hsla'));
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Core point - larger and brighter
      const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2);
      coreGradient.addColorStop(0, star.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
      coreGradient.addColorStop(0.4, star.color.replace(')', `, ${alpha * 0.5})`).replace('hsl', 'hsla'));
      coreGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(x, y, star.size * 2, 0, Math.PI * 2);
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

  // Calculate complex barred spiral galaxy position
  const getSpiralGalaxyPosition = useCallback((index: number, total: number, centerX: number, centerY: number, maxRadius: number) => {
    // Barred spiral galaxy with 2 major arms + 2 minor arms
    const random = ((index * 9301 + 49297) % 233280) / 233280; // Seeded random for consistency
    const random2 = ((index * 7919 + 104729) % 233280) / 233280;
    const random3 = ((index * 6571 + 86969) % 233280) / 233280;
    
    // Determine star type: core, bar, major arm, minor arm, or halo
    const starType = random < 0.15 ? 'core' : 
                     random < 0.25 ? 'bar' : 
                     random < 0.65 ? 'major' : 
                     random < 0.85 ? 'minor' : 'halo';
    
    let x: number, y: number;
    
    if (starType === 'core') {
      // Dense central bulge - elliptical distribution
      const r = Math.pow(random2, 0.5) * maxRadius * 0.15;
      const theta = random3 * Math.PI * 2;
      const ellipseRatio = 0.7;
      x = centerX + r * Math.cos(theta);
      y = centerY + r * Math.sin(theta) * ellipseRatio;
    } else if (starType === 'bar') {
      // Central bar structure
      const barLength = maxRadius * 0.35;
      const barWidth = maxRadius * 0.08;
      const barAngle = Math.PI * 0.15; // Tilted bar
      const alongBar = (random2 - 0.5) * 2 * barLength;
      const acrossBar = (random3 - 0.5) * 2 * barWidth * (1 - Math.abs(alongBar) / barLength * 0.5);
      x = centerX + alongBar * Math.cos(barAngle) - acrossBar * Math.sin(barAngle);
      y = centerY + alongBar * Math.sin(barAngle) + acrossBar * Math.cos(barAngle);
    } else if (starType === 'major' || starType === 'minor') {
      // Spiral arms using logarithmic spiral
      const armIndex = starType === 'major' ? (index % 2) : (index % 2) + 2;
      const baseAngle = (armIndex / 4) * Math.PI * 2 + Math.PI * 0.15; // Aligned with bar
      
      // Distance along arm (0 to 1)
      const armPosition = Math.pow(random2, 0.7);
      
      // Logarithmic spiral: θ = a + b * ln(r)
      const spiralTightness = starType === 'major' ? 0.4 : 0.35;
      const armRotations = starType === 'major' ? 1.8 : 1.5;
      const theta = baseAngle + armPosition * Math.PI * 2 * armRotations;
      const r = maxRadius * 0.2 + armPosition * maxRadius * 0.75;
      
      // Width varies along arm - wider at outer edges
      const armWidth = maxRadius * (0.04 + armPosition * 0.08) * (starType === 'major' ? 1 : 0.6);
      const perpOffset = (random3 - 0.5) * 2 * armWidth;
      const perpAngle = theta + Math.PI / 2;
      
      x = centerX + r * Math.cos(theta) + perpOffset * Math.cos(perpAngle);
      y = centerY + r * Math.sin(theta) + perpOffset * Math.sin(perpAngle);
    } else {
      // Halo stars - sparse outer region
      const r = maxRadius * (0.6 + random2 * 0.4);
      const theta = random3 * Math.PI * 2;
      x = centerX + r * Math.cos(theta);
      y = centerY + r * Math.sin(theta);
    }
    
    return { x, y, starType };
  }, []);

  // Apply complex three-phase spiral animation
  const applySpiralAnimation = useCallback((centerX: number, centerY: number, canvasWidth: number, canvasHeight: number) => {
    const progress = spiralProgressRef.current;
    const maxRadius = Math.min(canvasWidth, canvasHeight) * 0.42;
    
    // Three phases:
    // Phase 1 (0-0.3): Gathering - stars accelerate toward swirl paths
    // Phase 2 (0.3-0.6): Vortex - tight inward spiral with increasing speed
    // Phase 3 (0.6-1.0): Unfurl - expand outward into galaxy formation
    
    const phase = progress < 0.3 ? 1 : progress < 0.6 ? 2 : 3;
    
    milkyWayStarsRef.current.forEach((star, index) => {
      // Store original position and calculate target on first frame
      if (!starOriginalPositionsRef.current.has(index)) {
        starOriginalPositionsRef.current.set(index, { x: star.x, y: star.y });
        const target = getSpiralGalaxyPosition(index, milkyWayStarsRef.current.length, centerX, centerY, maxRadius);
        spiralTargetPositionsRef.current.set(index, target);
      }
      
      const original = starOriginalPositionsRef.current.get(index)!;
      const target = spiralTargetPositionsRef.current.get(index)!;
      
      const dx = centerX - star.x;
      const dy = centerY - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Seeded random for consistent per-star variation
      const starRandom = ((index * 9301 + 49297) % 233280) / 233280;
      const speedVariation = 0.7 + starRandom * 0.6;
      
      if (phase === 1) {
        // Phase 1: Gathering - stars begin curved movement toward center
        const phaseProgress = progress / 0.3;
        const easeIn = Math.pow(phaseProgress, 2);
        
        // Gradual curve toward center with rotation
        const angularSpeed = 0.015 * easeIn * speedVariation * (1 + 80 / (distance + 60));
        const radialPull = distance * 0.008 * easeIn * speedVariation;
        
        const newAngle = angle + angularSpeed;
        const newDistance = Math.max(20, distance - radialPull);
        
        star.x = centerX - Math.cos(newAngle) * newDistance;
        star.y = centerY - Math.sin(newAngle) * newDistance;
        
      } else if (phase === 2) {
        // Phase 2: Vortex - dramatic inward spiral
        const phaseProgress = (progress - 0.3) / 0.3;
        const easeInOut = phaseProgress < 0.5 
          ? 2 * phaseProgress * phaseProgress 
          : 1 - Math.pow(-2 * phaseProgress + 2, 2) / 2;
        
        // Faster rotation, stronger pull - Kepler-like (closer = faster)
        const keplerFactor = Math.pow(Math.max(distance, 30), -0.5);
        const angularSpeed = 0.06 * (0.5 + easeInOut) * speedVariation * keplerFactor * 15;
        const radialPull = distance * 0.025 * easeInOut * speedVariation;
        
        // Add wobble for visual interest
        const wobble = Math.sin(progress * 20 + index * 0.1) * 0.3;
        
        const newAngle = angle + angularSpeed + wobble * 0.02;
        const newDistance = Math.max(8, distance - radialPull);
        
        star.x = centerX - Math.cos(newAngle) * newDistance;
        star.y = centerY - Math.sin(newAngle) * newDistance;
        
      } else {
        // Phase 3: Unfurl - expand into spiral galaxy
        const phaseProgress = (progress - 0.6) / 0.4;
        const easeOut = 1 - Math.pow(1 - phaseProgress, 3);
        
        // Stars continue rotating while moving to final positions
        const remainingRotation = (1 - easeOut) * Math.PI * 1.2;
        
        // Calculate rotated target position
        const tdx = target.x - centerX;
        const tdy = target.y - centerY;
        const targetAngle = Math.atan2(tdy, tdx) + remainingRotation;
        const targetDist = Math.sqrt(tdx * tdx + tdy * tdy);
        
        const rotatedTargetX = centerX + targetDist * Math.cos(targetAngle);
        const rotatedTargetY = centerY + targetDist * Math.sin(targetAngle);
        
        // Smooth interpolation with variable speed based on distance
        const interpSpeed = 0.04 + easeOut * 0.06;
        star.x = star.x + (rotatedTargetX - star.x) * interpSpeed;
        star.y = star.y + (rotatedTargetY - star.y) * interpSpeed;
      }
    });
    
    // Background stars - gentler effect with phase awareness
    backgroundStarsRef.current.forEach((star, index) => {
      const bgIndex = index + 100000;
      if (!starOriginalPositionsRef.current.has(bgIndex)) {
        starOriginalPositionsRef.current.set(bgIndex, { x: star.x, y: star.y });
      }
      
      const original = starOriginalPositionsRef.current.get(bgIndex)!;
      const dx = centerX - star.x;
      const dy = centerY - star.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const starRandom = ((index * 7919 + 104729) % 233280) / 233280;
      
      if (phase === 1 || phase === 2) {
        // Gentle swirl during vortex phases
        const phaseProgress = phase === 1 ? progress / 0.3 : 0.5 + (progress - 0.3) / 0.6;
        const easeIn = Math.pow(phaseProgress, 1.5);
        
        const angularSpeed = 0.008 * easeIn * (0.8 + starRandom * 0.4) * (1 + 50 / (distance + 120));
        const radialPull = distance * 0.004 * easeIn;
        
        const newAngle = angle + angularSpeed;
        const newDistance = Math.max(50, distance - radialPull);
        
        star.x = centerX - Math.cos(newAngle) * newDistance;
        star.y = centerY - Math.sin(newAngle) * newDistance;
      } else {
        // Phase 3: Drift back to original positions
        const phaseProgress = (progress - 0.6) / 0.4;
        star.x = star.x + (original.x - star.x) * 0.015 * (1 + phaseProgress);
        star.y = star.y + (original.y - star.y) * 0.015 * (1 + phaseProgress);
      }
    });
  }, [getSpiralGalaxyPosition]);

  // Reset stars to original positions gradually
  const resetStarPositions = useCallback((centerX: number, centerY: number) => {
    milkyWayStarsRef.current.forEach((star, index) => {
      const original = starOriginalPositionsRef.current.get(index);
      if (original) {
        star.baseX = original.x;
        star.baseY = original.y;
        star.x = original.x;
        star.y = original.y;
      }
    });
    
    backgroundStarsRef.current.forEach((star, index) => {
      const bgIndex = index + 100000;
      const original = starOriginalPositionsRef.current.get(bgIndex);
      if (original) {
        star.baseX = original.x;
        star.baseY = original.y;
        star.x = original.x;
        star.y = original.y;
      }
    });
    
    starOriginalPositionsRef.current.clear();
    spiralTargetPositionsRef.current.clear();
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Handle spiral animation - three phases: gather, vortex, unfurl
    if (spiralActiveRef.current) {
      spiralProgressRef.current = Math.min(1, spiralProgressRef.current + 0.0035);
      applySpiralAnimation(centerX, centerY, canvas.width, canvas.height);
    } else if (spiralProgressRef.current > 0) {
      // Gradually return to normal
      spiralProgressRef.current = Math.max(0, spiralProgressRef.current - 0.04);
      if (spiralProgressRef.current === 0) {
        resetStarPositions(centerX, centerY);
      }
    }

    // Clear with deep space black
    ctx.fillStyle = 'hsl(230, 30%, 3%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth mouse tracking for parallax
    smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.04;
    smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.04;
    
    // Calculate parallax offset from center
    const parallaxX = (smoothMouseRef.current.x - canvas.width / 2) / canvas.width;
    const parallaxY = (smoothMouseRef.current.y - canvas.height / 2) / canvas.height;

    // Spawn shooting stars (only when not spiraling)
    const now = Date.now();
    if (!spiralActiveRef.current && now - lastShootingStarRef.current > 4000 + Math.random() * 6000) {
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
    
    // 1. Galactic core glow (furthest back) - intensify during spiral
    drawGalacticCore(ctx, canvas.width, canvas.height, parallaxX, parallaxY);
    
    // Draw dynamic vortex effects during spiral animation
    if (spiralProgressRef.current > 0) {
      const progress = spiralProgressRef.current;
      const phase = progress < 0.3 ? 1 : progress < 0.6 ? 2 : 3;
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      
      if (phase === 1) {
        // Phase 1: Subtle gathering glow
        const phaseIntensity = progress / 0.3;
        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200 * phaseIntensity);
        glow.addColorStop(0, `hsla(220, 70%, 60%, ${0.15 * phaseIntensity})`);
        glow.addColorStop(0.5, `hsla(240, 50%, 40%, ${0.08 * phaseIntensity})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (phase === 2) {
        // Phase 2: Intense vortex glow with pulsing
        const phaseProgress = (progress - 0.3) / 0.3;
        const pulse = 1 + Math.sin(time * 0.008) * 0.15;
        const intensity = (0.5 + phaseProgress * 0.5) * pulse;
        
        // Outer ring
        const outerGlow = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 180);
        outerGlow.addColorStop(0, `hsla(280, 80%, 65%, ${0.35 * intensity})`);
        outerGlow.addColorStop(0.4, `hsla(260, 70%, 50%, ${0.2 * intensity})`);
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Inner bright core
        const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60);
        coreGlow.addColorStop(0, `hsla(200, 90%, 80%, ${0.5 * intensity})`);
        coreGlow.addColorStop(0.3, `hsla(260, 80%, 70%, ${0.3 * intensity})`);
        coreGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGlow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Swirl lines effect
        const numSwirls = 4;
        for (let i = 0; i < numSwirls; i++) {
          const swirlAngle = (i / numSwirls) * Math.PI * 2 + time * 0.003;
          const swirlLength = 120 * intensity;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          for (let t = 0; t < 1; t += 0.05) {
            const r = t * swirlLength;
            const theta = swirlAngle + t * Math.PI * 0.8;
            ctx.lineTo(centerX + r * Math.cos(theta), centerY + r * Math.sin(theta));
          }
          ctx.strokeStyle = `hsla(260, 70%, 70%, ${0.15 * intensity * (1 - phaseProgress * 0.5)})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else {
        // Phase 3: Fading glow as galaxy forms
        const phaseProgress = (progress - 0.6) / 0.4;
        const fadeOut = 1 - phaseProgress;
        
        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 250);
        glow.addColorStop(0, `hsla(45, 80%, 70%, ${0.2 * fadeOut})`);
        glow.addColorStop(0.3, `hsla(35, 60%, 50%, ${0.1 * fadeOut})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.restore();
    }
    
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
  }, [drawGalacticCore, drawBackgroundStars, drawDustLanes, drawMilkyWayStars, drawNebulae, drawShootingStar, drawVignette, createShootingStar, applySpiralAnimation, resetStarPositions]);

  // Update spiral state from prop
  useEffect(() => {
    spiralActiveRef.current = spiralActive;
    if (spiralActive) {
      spiralProgressRef.current = 0;
    }
  }, [spiralActive]);

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
