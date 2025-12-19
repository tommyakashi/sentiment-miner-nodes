import { useEffect, useRef, useCallback, useMemo } from 'react';

interface MilkyWayStar {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftPhase: number;
  driftSpeed: number;
  colorHsla: string; // Pre-computed HSLA color
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
  colorHsla: string; // Pre-computed HSLA color
  isSimple: boolean; // Use simple fillRect for tiny stars
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
  colorHsla: string; // Pre-computed
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
  colorHsla: string;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
  dataCount?: number;
}

interface PerformanceTier {
  milkyWayStars: number;
  bulgeStars: number;
  backgroundStars: number;
  dustLanes: number;
  nebulae: number;
  targetFps: number;
  canvasScale: number;
  useSimpleStars: boolean;
}

// Detect device performance tier
const detectPerformanceTier = (): PerformanceTier => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isHighDPI = window.devicePixelRatio > 1.5;
  
  // Check for Safari (often slower with canvas)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (prefersReducedMotion) {
    return {
      milkyWayStars: 200,
      bulgeStars: 50,
      backgroundStars: 50,
      dustLanes: 2,
      nebulae: 4,
      targetFps: 15,
      canvasScale: 0.5,
      useSimpleStars: true,
    };
  }
  
  if (isMobile) {
    return {
      milkyWayStars: 150,
      bulgeStars: 40,
      backgroundStars: 30,
      dustLanes: 2,
      nebulae: 3,
      targetFps: 24,
      canvasScale: 0.4,
      useSimpleStars: true,
    };
  }
  
  if (isLowEndDevice || isSafari) {
    return {
      milkyWayStars: 250,
      bulgeStars: 60,
      backgroundStars: 50,
      dustLanes: 2,
      nebulae: 4,
      targetFps: 30,
      canvasScale: 0.5,
      useSimpleStars: true,
    };
  }
  
  // High-end device - reduced for better performance
  return {
    milkyWayStars: 400,
    bulgeStars: 100,
    backgroundStars: 80,
    dustLanes: 3,
    nebulae: 6,
    targetFps: 30,
    canvasScale: isHighDPI ? 0.5 : 0.75,
    useSimpleStars: true,
  };
};

// Stellar colors with pre-computed HSLA values
const stellarColors = [
  { h: 210, s: 100, l: 92, weight: 0.03 },  // O/B - Hot blue
  { h: 200, s: 80, l: 90, weight: 0.07 },   // A - Blue-white
  { h: 45, s: 15, l: 96, weight: 0.12 },    // F - White
  { h: 45, s: 35, l: 88, weight: 0.20 },    // G - Yellow-white
  { h: 30, s: 55, l: 78, weight: 0.30 },    // K - Orange
  { h: 15, s: 65, l: 68, weight: 0.28 },    // M - Red
];

const nebulaPatchHSL = [
  { h: 280, s: 60, l: 50 },
  { h: 340, s: 50, l: 45 },
  { h: 185, s: 60, l: 40 },
  { h: 200, s: 50, l: 35 },
];

const bgStarHSL = [
  { h: 210, s: 25, l: 80 },
  { h: 200, s: 20, l: 75 },
  { h: 45, s: 10, l: 85 },
  { h: 35, s: 20, l: 70 },
  { h: 0, s: 0, l: 80 },
];

// Pre-compute HSLA string
const toHsla = (h: number, s: number, l: number, a: number): string => 
  `hsla(${h}, ${s}%, ${l}%, ${a})`;

// Select star color based on weighted distribution
const selectStarColor = (): { h: number; s: number; l: number; temp: number } => {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < stellarColors.length; i++) {
    cumulative += stellarColors[i].weight;
    if (rand < cumulative) {
      return { ...stellarColors[i], temp: i };
    }
  }
  return { ...stellarColors[4], temp: 4 };
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
  const lastFrameTimeRef = useRef(0);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const performanceTierRef = useRef<PerformanceTier>(detectPerformanceTier());

  // Memoize performance tier
  const tier = useMemo(() => performanceTierRef.current, []);
  const frameInterval = useMemo(() => 1000 / tier.targetFps, [tier.targetFps]);

  // Create Milky Way stars with pre-computed colors
  const createMilkyWayStars = useCallback((width: number, height: number): MilkyWayStar[] => {
    const stars: MilkyWayStar[] = [];
    const starCount = tier.milkyWayStars;
    const bulgeStarCount = tier.bulgeStars;
    const bandWidth = height * 0.5;
    
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
      const alpha = (Math.random() * 0.6 + 0.4) * bandAlphaMultiplier * tempBrightness;
      
      stars.push({
        x,
        y: Math.max(0, Math.min(height, y)),
        baseX: x,
        baseY: Math.max(0, Math.min(height, y)),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: (Math.random() * 2.5 + 0.5) * (starColor.temp < 2 ? 1.6 : 1),
        alpha,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.008 + 0.003,
        colorHsla: toHsla(starColor.h, starColor.s, starColor.l, 1),
        colorTemp: starColor.temp,
      });
    }
    
    // Galactic bulge
    const bulgeCenterX = width * 0.5;
    const bulgeCenterY = height * 0.2 + 0.5 * height * 0.6 + Math.sin(0.5 * Math.PI) * height * 0.08;
    const bulgeRadiusX = width * 0.2;
    const bulgeRadiusY = height * 0.18;
    
    for (let i = 0; i < bulgeStarCount; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const g1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const g2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
      
      const x = bulgeCenterX + g1 * bulgeRadiusX * 0.5;
      const y = bulgeCenterY + g2 * bulgeRadiusY * 0.5;
      
      const bulgeColorIdx = Math.floor(Math.random() * 3) + 3; // G, K, M types
      const starColor = stellarColors[bulgeColorIdx];
      
      const distFromCenter = Math.sqrt(
        Math.pow((x - bulgeCenterX) / bulgeRadiusX, 2) + 
        Math.pow((y - bulgeCenterY) / bulgeRadiusY, 2)
      );
      const bulgeAlpha = Math.max(0.3, 1 - distFromCenter * 0.6);
      const alpha = (Math.random() * 0.5 + 0.4) * bulgeAlpha;
      
      stars.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 0.8,
        alpha,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.006 + 0.002,
        colorHsla: toHsla(starColor.h, starColor.s, starColor.l, 1),
        colorTemp: bulgeColorIdx,
      });
    }
    
    return stars;
  }, [tier.milkyWayStars, tier.bulgeStars]);

  // Create background stars with simple flag for tiny stars
  const createBackgroundStars = useCallback((width: number, height: number): BackgroundStar[] => {
    const stars: BackgroundStar[] = [];
    const starCount = tier.backgroundStars;
    
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 1.2 + 0.3;
      const colorIdx = Math.floor(Math.random() * bgStarHSL.length);
      const color = bgStarHSL[colorIdx];
      
      stars.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size,
        alpha: Math.random() * 0.3 + 0.08,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.004 + 0.001,
        colorHsla: toHsla(color.h, color.s, color.l, 1),
        isSimple: tier.useSimpleStars || size < 0.8,
      });
    }
    return stars;
  }, [tier.backgroundStars, tier.useSimpleStars]);

  // Create dust lanes
  const createDustLanes = useCallback((width: number, height: number): DustLane[] => {
    const lanes: DustLane[] = [];
    const laneCount = tier.dustLanes;
    
    for (let i = 0; i < laneCount; i++) {
      const points: { x: number; y: number }[] = [];
      const laneOffset = (i - laneCount / 2 + 0.5) * (height * 0.05);
      const waveAmplitude = 25 + Math.random() * 35;
      const waveFreq = 0.004 + Math.random() * 0.003;
      const phase = Math.random() * Math.PI * 2;
      
      for (let x = -100; x <= width + 100; x += 50) {
        const xRatio = x / width;
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
  }, [tier.dustLanes]);

  // Create nebula patches
  const createNebulae = useCallback((width: number, height: number): NebulaPatch[] => {
    const patches: NebulaPatch[] = [];
    const bandWidth = height * 0.4;
    const patchCount = tier.nebulae;
    
    for (let i = 0; i < patchCount; i++) {
      const x = Math.random() * width;
      const xRatio = x / width;
      const diagonalY = height * 0.2 + xRatio * height * 0.6;
      const curveOffset = Math.sin(xRatio * Math.PI) * height * 0.08;
      const bandCenterAtX = diagonalY + curveOffset;
      const y = bandCenterAtX + (Math.random() - 0.5) * bandWidth;
      const colorIdx = Math.floor(Math.random() * nebulaPatchHSL.length);
      const color = nebulaPatchHSL[colorIdx];
      const alpha = Math.random() * 0.15 + 0.05;
      
      patches.push({
        x,
        y,
        size: Math.random() * 60 + 30,
        colorHsla: toHsla(color.h, color.s, color.l, alpha),
        alpha,
        rotation: Math.random() * Math.PI * 2,
      });
    }
    return patches;
  }, [tier.nebulae]);

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

    const colorIdx = Math.floor(Math.random() * 3);
    const color = stellarColors[colorIdx];

    return {
      x, y, vx, vy,
      life: 0,
      maxLife: 70 + Math.random() * 40,
      trail: [],
      colorHsla: toHsla(color.h, color.s, color.l, 1),
    };
  }, []);

  // Pre-render static elements to offscreen canvas
  const renderStaticElements = useCallback((width: number, height: number) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Draw galactic core glow
    const coreX = width * 0.5;
    const coreY = height * 0.2 + 0.5 * height * 0.6 + Math.sin(0.5 * Math.PI) * height * 0.08;
    
    ctx.globalCompositeOperation = 'lighter';
    
    const outerGlow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, width * 0.35);
    outerGlow.addColorStop(0, 'hsla(40, 80%, 70%, 0.12)');
    outerGlow.addColorStop(0.2, 'hsla(35, 70%, 60%, 0.08)');
    outerGlow.addColorStop(0.5, 'hsla(30, 60%, 50%, 0.04)');
    outerGlow.addColorStop(0.8, 'hsla(25, 50%, 40%, 0.01)');
    outerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, width, height);
    
    const innerGlow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, width * 0.15);
    innerGlow.addColorStop(0, 'hsla(45, 90%, 85%, 0.15)');
    innerGlow.addColorStop(0.3, 'hsla(40, 80%, 70%, 0.08)');
    innerGlow.addColorStop(0.7, 'hsla(35, 60%, 55%, 0.03)');
    innerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, width, height);

    return offscreen;
  }, []);

  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = tier.canvasScale;
    const width = canvas.width / scale;
    const height = canvas.height / scale;

    milkyWayStarsRef.current = createMilkyWayStars(width, height);
    backgroundStarsRef.current = createBackgroundStars(width, height);
    dustLanesRef.current = createDustLanes(width, height);
    nebulaPatchesRef.current = createNebulae(width, height);
    shootingStarsRef.current = [];
    staticCanvasRef.current = renderStaticElements(width, height);
  }, [createMilkyWayStars, createBackgroundStars, createDustLanes, createNebulae, renderStaticElements, tier.canvasScale]);

  // Draw dust lanes
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

  // Draw background stars - simplified for tiny stars
  const drawBackgroundStars = useCallback((ctx: CanvasRenderingContext2D, parallaxX: number, parallaxY: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    backgroundStarsRef.current.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      star.driftPhase += star.driftSpeed;
      
      const driftX = Math.sin(star.driftPhase) * 8;
      const driftY = Math.cos(star.driftPhase * 0.7) * 6;
      star.x = star.baseX + driftX;
      star.y = star.baseY + driftY;
      
      const twinkle = Math.sin(star.twinklePhase) * 0.4 + 0.6;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 8;
      const offsetY = parallaxY * 8;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      if (star.isSimple) {
        // Simple fillRect for tiny/distant stars - much faster
        ctx.fillStyle = star.colorHsla.replace(', 1)', `, ${alpha})`);
        ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
      } else {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2.5);
        gradient.addColorStop(0, star.colorHsla.replace(', 1)', `, ${alpha})`));
        gradient.addColorStop(0.5, star.colorHsla.replace(', 1)', `, ${alpha * 0.3})`));
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.restore();
  }, []);

  // Draw Milky Way stars
  const drawMilkyWayStars = useCallback((ctx: CanvasRenderingContext2D, parallaxX: number, parallaxY: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    milkyWayStarsRef.current.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      star.driftPhase += star.driftSpeed;
      
      const driftX = Math.sin(star.driftPhase) * 12 + Math.sin(star.driftPhase * 1.5) * 5;
      const driftY = Math.cos(star.driftPhase * 0.8) * 10 + Math.cos(star.driftPhase * 1.3) * 4;
      star.x = star.baseX + driftX;
      star.y = star.baseY + driftY;
      
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.alpha * twinkle;
      
      const offsetX = parallaxX * 25;
      const offsetY = parallaxY * 25;
      const x = star.x + offsetX;
      const y = star.y + offsetY;
      
      // Only draw glow for bright hot stars on high-end devices
      if (!tier.useSimpleStars && star.colorTemp < 3 && star.alpha > 0.4) {
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 5);
        glowGradient.addColorStop(0, star.colorHsla.replace(', 1)', `, ${alpha * 0.6})`));
        glowGradient.addColorStop(0.3, star.colorHsla.replace(', 1)', `, ${alpha * 0.2})`));
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Core point
      if (tier.useSimpleStars && star.size < 1.5) {
        ctx.fillStyle = star.colorHsla.replace(', 1)', `, ${alpha})`);
        ctx.fillRect(x - star.size, y - star.size, star.size * 2, star.size * 2);
      } else {
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, star.size * 2);
        coreGradient.addColorStop(0, star.colorHsla.replace(', 1)', `, ${alpha})`));
        coreGradient.addColorStop(0.4, star.colorHsla.replace(', 1)', `, ${alpha * 0.5})`));
        coreGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.restore();
  }, [tier.useSimpleStars]);

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
      gradient.addColorStop(0, patch.colorHsla);
      gradient.addColorStop(0.4, patch.colorHsla.replace(/[\d.]+\)$/, `${patch.alpha * 0.4})`));
      gradient.addColorStop(0.7, patch.colorHsla.replace(/[\d.]+\)$/, `${patch.alpha * 0.1})`));
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

    // Trail - simplified for performance
    const trailStep = tier.useSimpleStars ? 2 : 1;
    for (let i = 0; i < star.trail.length; i += trailStep) {
      const point = star.trail[i];
      const trailAlpha = (1 - i / star.trail.length) * alpha * 0.5;
      const trailSize = 2.5 * (1 - i / star.trail.length);
      
      if (tier.useSimpleStars) {
        ctx.fillStyle = `hsla(0, 0%, 100%, ${trailAlpha})`;
        ctx.fillRect(point.x - trailSize, point.y - trailSize, trailSize * 2, trailSize * 2);
      } else {
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, trailSize * 3);
        gradient.addColorStop(0, `hsla(0, 0%, 100%, ${trailAlpha})`);
        gradient.addColorStop(0.4, star.colorHsla.replace(', 1)', `, ${trailAlpha * 0.5})`));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, trailSize * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Head
    const headGradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 6);
    headGradient.addColorStop(0, `hsla(0, 0%, 100%, ${alpha})`);
    headGradient.addColorStop(0.4, star.colorHsla.replace(', 1)', `, ${alpha * 0.7})`));
    headGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(star.x, star.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [tier.useSimpleStars]);

  // Draw vignette
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

  const draw = useCallback((timestamp: number) => {
    // Frame rate limiting
    const elapsed = timestamp - lastFrameTimeRef.current;
    if (elapsed < frameInterval) {
      animationRef.current = requestAnimationFrame(draw);
      return;
    }
    lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const scale = tier.canvasScale;
    const width = canvas.width / scale;
    const height = canvas.height / scale;

    // Scale context for lower resolution rendering
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Clear with deep space black
    ctx.fillStyle = 'hsl(230, 30%, 3%)';
    ctx.fillRect(0, 0, width, height);

    // Smooth mouse tracking for parallax
    smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.04;
    smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.04;
    
    const parallaxX = (smoothMouseRef.current.x / scale - width / 2) / width;
    const parallaxY = (smoothMouseRef.current.y / scale - height / 2) / height;

    // Spawn shooting stars
    const now = Date.now();
    if (now - lastShootingStarRef.current > 4000 + Math.random() * 6000) {
      shootingStarsRef.current.push(createShootingStar(width, height));
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
             star.x > -50 && star.x < width + 50 &&
             star.y > -50 && star.y < height + 50;
    });

    // DRAW ORDER:
    
    // 1. Pre-rendered static elements (galactic core)
    if (staticCanvasRef.current) {
      const offsetX = parallaxX * 20;
      const offsetY = parallaxY * 20;
      ctx.drawImage(staticCanvasRef.current, offsetX, offsetY);
    }
    
    // 2. Background stars
    drawBackgroundStars(ctx, parallaxX, parallaxY);
    
    // 3. Dust lanes
    drawDustLanes(ctx, parallaxX, parallaxY);
    
    // 4. Milky Way stars
    drawMilkyWayStars(ctx, parallaxX, parallaxY);
    
    // 5. Nebulae
    drawNebulae(ctx, parallaxX, parallaxY);
    
    // 6. Shooting stars
    shootingStarsRef.current.forEach(star => {
      drawShootingStar(ctx, star);
    });
    
    // 7. Vignette
    drawVignette(ctx, width, height);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    animationRef.current = requestAnimationFrame(draw);
  }, [frameInterval, tier.canvasScale, drawBackgroundStars, drawDustLanes, drawMilkyWayStars, drawNebulae, drawShootingStar, drawVignette, createShootingStar]);

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
