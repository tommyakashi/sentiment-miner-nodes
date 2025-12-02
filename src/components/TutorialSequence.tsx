import { useState, useEffect, useCallback } from 'react';
import { Settings, Radio, Brain, BarChart3, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  shortDesc: string;
  instruction: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: <Settings className="w-6 h-6" />,
    title: 'Configure Nodes',
    shortDesc: 'Set analysis topics',
    instruction: 'Start here to set up your analysis topics. These "nodes" define what themes you want to track across your data.',
    targetSelector: '[data-tutorial="settings"]',
    position: 'top',
  },
  {
    icon: <Radio className="w-6 h-6" />,
    title: 'Scrape Reddit',
    shortDesc: 'Collect social data',
    instruction: 'Collect sentiment data from research communities on Reddit. Configure subreddits, time range, and hit scrape.',
    targetSelector: '[data-tutorial="scanner"]',
    position: 'bottom',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Academic Papers',
    shortDesc: 'Research literature',
    instruction: 'Scrape academic papers from arXiv and Semantic Scholar. Search by keywords or authors.',
    targetSelector: '[data-tutorial="papers"]',
    position: 'bottom',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Run Analysis',
    shortDesc: 'AI-powered insights',
    instruction: 'After scraping, click "Run Analysis" to process your data. AI will evaluate sentiment across all your nodes.',
    targetSelector: '[data-tutorial="analysis"]',
    position: 'top',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'View Results',
    shortDesc: 'Explore trends',
    instruction: 'Explore sentiment scores, trends, and key insights. Results are organized by your configured analysis nodes.',
    targetSelector: '[data-tutorial="archive"]',
    position: 'top',
  },
];

const STEP_REVEAL_DELAY = 400; // ms between each step appearing in overview
const OVERVIEW_HOLD_TIME = 2000; // ms to hold after all steps shown before transitioning

interface TutorialSequenceProps {
  onComplete: () => void;
  currentView: 'modeSelector' | 'scanner' | 'papers' | 'analysis' | 'settings' | null;
}

export function TutorialSequence({ onComplete, currentView }: TutorialSequenceProps) {
  const [phase, setPhase] = useState<'overview' | 'walkthrough' | 'complete'>('overview');
  const [overviewStep, setOverviewStep] = useState(-1);
  const [activeGlowIndex, setActiveGlowIndex] = useState(-1);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isFadingOverview, setIsFadingOverview] = useState(false);

  // Phase 1: Overview - reveal steps sequentially
  useEffect(() => {
    if (phase !== 'overview') return;

    const revealTimers: NodeJS.Timeout[] = [];
    
    // Reveal each step
    TUTORIAL_STEPS.forEach((_, index) => {
      const timer = setTimeout(() => {
        setOverviewStep(index);
        setActiveGlowIndex(index);
      }, index * STEP_REVEAL_DELAY);
      revealTimers.push(timer);
    });

    // After all revealed, hold then transition to walkthrough
    const transitionTimer = setTimeout(() => {
      setIsFadingOverview(true);
      setTimeout(() => {
        setPhase('walkthrough');
        setIsFadingOverview(false);
      }, 500);
    }, (TUTORIAL_STEPS.length * STEP_REVEAL_DELAY) + OVERVIEW_HOLD_TIME);

    return () => {
      revealTimers.forEach(clearTimeout);
      clearTimeout(transitionTimer);
    };
  }, [phase]);

  // Phase 2: Walkthrough - highlight actual UI elements
  const updateTargetPosition = useCallback(() => {
    if (phase !== 'walkthrough') return;
    
    const step = TUTORIAL_STEPS[walkthroughStep];
    if (!step) return;

    const target = document.querySelector(step.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      setHighlightRect(rect);
    } else {
      setHighlightRect(null);
    }
  }, [phase, walkthroughStep]);

  useEffect(() => {
    if (phase !== 'walkthrough') return;
    
    updateTargetPosition();
    window.addEventListener('resize', updateTargetPosition);
    const interval = setInterval(updateTargetPosition, 300);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      clearInterval(interval);
    };
  }, [updateTargetPosition, phase]);

  const handleNext = () => {
    if (walkthroughStep < TUTORIAL_STEPS.length - 1) {
      setWalkthroughStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem('tutorial-completed', 'true');
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  // Phase 1: Overview
  if (phase === 'overview') {
    return (
      <div 
        className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl transition-opacity duration-500 ${
          isFadingOverview ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* Title */}
        <div 
          className={`mb-10 text-center transition-all duration-700 ${
            overviewStep >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h2 className="text-xl font-medium text-foreground tracking-wide mb-2">
            Quick Start Guide
          </h2>
          <p className="text-sm text-muted-foreground">
            5 steps to sentiment analysis
          </p>
        </div>

        {/* Steps container */}
        <div className="flex items-center gap-3">
          {TUTORIAL_STEPS.map((step, index) => {
            const isRevealed = index <= overviewStep;
            const isGlowing = index === activeGlowIndex;
            
            return (
              <div key={index} className="flex items-center">
                {/* Step box */}
                <div
                  className={`
                    relative flex flex-col items-center justify-center
                    w-28 h-32 rounded-xl
                    bg-card/70 backdrop-blur-2xl
                    border transition-all duration-500
                    ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                    ${isGlowing 
                      ? 'border-primary shadow-[0_0_60px_rgba(255,255,255,0.4),0_0_100px_rgba(255,255,255,0.2)]' 
                      : 'border-border/40'
                    }
                  `}
                  style={{
                    transitionDelay: isRevealed ? '0ms' : `${index * 50}ms`,
                  }}
                >
                  {/* Intense glow effect for active step */}
                  {isGlowing && (
                    <>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />
                      <div className="absolute -inset-1 rounded-xl bg-white/10 blur-xl pointer-events-none animate-pulse" />
                    </>
                  )}
                  
                  {/* Icon */}
                  <div className={`
                    mb-2 transition-all duration-500
                    ${isGlowing ? 'text-white scale-110' : 'text-muted-foreground'}
                  `}>
                    {step.icon}
                  </div>
                  
                  {/* Title */}
                  <span className={`
                    text-xs font-semibold text-center px-2 transition-colors duration-300
                    ${isGlowing ? 'text-white' : 'text-foreground/80'}
                  `}>
                    {step.title}
                  </span>
                  
                  {/* Short description */}
                  <span className="text-[10px] text-muted-foreground/70 text-center px-2 mt-1">
                    {step.shortDesc}
                  </span>

                  {/* Step number */}
                  <div className={`
                    absolute -top-2 -right-2 w-6 h-6 rounded-full
                    flex items-center justify-center text-xs font-bold
                    transition-all duration-500
                    ${isGlowing 
                      ? 'bg-white text-background shadow-[0_0_20px_rgba(255,255,255,0.6)]' 
                      : 'bg-muted/80 text-muted-foreground'
                    }
                  `}>
                    {index + 1}
                  </div>
                </div>

                {/* Connector line */}
                {index < TUTORIAL_STEPS.length - 1 && (
                  <div 
                    className={`
                      w-6 h-px mx-1 transition-all duration-500
                      ${index < overviewStep 
                        ? 'bg-white/40' 
                        : 'bg-transparent'
                      }
                    `}
                    style={{
                      transitionDelay: `${(index + 1) * STEP_REVEAL_DELAY}ms`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Skip button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className={`
            mt-10 text-muted-foreground hover:text-foreground
            transition-all duration-500
            ${overviewStep >= 0 ? 'opacity-100' : 'opacity-0'}
          `}
        >
          Skip Tutorial
        </Button>
      </div>
    );
  }

  // Phase 2: Walkthrough
  const step = TUTORIAL_STEPS[walkthroughStep];
  const hasTarget = highlightRect !== null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dimmed overlay with cutout */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {hasTarget && (
                <rect
                  x={highlightRect.left - 12}
                  y={highlightRect.top - 12}
                  width={highlightRect.width + 24}
                  height={highlightRect.height + 24}
                  rx="16"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.85)"
            mask="url(#tutorial-mask)"
          />
        </svg>
      </div>

      {/* Intense highlight border with glow */}
      {hasTarget && (
        <>
          {/* Outer glow layers */}
          <div
            className="absolute rounded-2xl pointer-events-none"
            style={{
              left: highlightRect.left - 20,
              top: highlightRect.top - 20,
              width: highlightRect.width + 40,
              height: highlightRect.height + 40,
              boxShadow: '0 0 80px 20px rgba(255, 255, 255, 0.3)',
            }}
          />
          <div
            className="absolute rounded-2xl pointer-events-none animate-pulse"
            style={{
              left: highlightRect.left - 16,
              top: highlightRect.top - 16,
              width: highlightRect.width + 32,
              height: highlightRect.height + 32,
              boxShadow: '0 0 60px 10px rgba(255, 255, 255, 0.4)',
            }}
          />
          {/* Inner border */}
          <div
            className="absolute border-2 border-white rounded-2xl pointer-events-none"
            style={{
              left: highlightRect.left - 12,
              top: highlightRect.top - 12,
              width: highlightRect.width + 24,
              height: highlightRect.height + 24,
              boxShadow: 'inset 0 0 30px rgba(255, 255, 255, 0.2)',
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        className={`
          absolute pointer-events-auto
          transition-all duration-500 ease-out
          ${hasTarget ? 'opacity-100' : 'opacity-100'}
        `}
        style={{
          left: hasTarget 
            ? step.position === 'left' 
              ? highlightRect!.left - 340 
              : step.position === 'right'
                ? highlightRect!.right + 24
                : highlightRect!.left + highlightRect!.width / 2 - 160
            : '50%',
          top: hasTarget
            ? step.position === 'top'
              ? highlightRect!.top - 200
              : step.position === 'bottom'
                ? highlightRect!.bottom + 24
                : highlightRect!.top + highlightRect!.height / 2 - 90
            : '50%',
          transform: hasTarget ? 'none' : 'translate(-50%, -50%)',
        }}
      >
        <div className="w-[320px] bg-card/95 backdrop-blur-2xl rounded-xl border border-border/50 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border/30 bg-white/5">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white border border-white/20">
              {step.icon}
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                Step {walkthroughStep + 1} of {TUTORIAL_STEPS.length}
              </div>
              <div className="font-semibold text-foreground text-lg">
                {step.title}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.instruction}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pb-3">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === walkthroughStep 
                    ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]' 
                    : index < walkthroughStep 
                      ? 'bg-white/50' 
                      : 'bg-muted/50'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-4 pt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 bg-white text-background hover:bg-white/90"
            >
              {walkthroughStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Get Started'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
