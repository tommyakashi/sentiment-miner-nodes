import { useState, useEffect, useCallback } from 'react';
import { Settings, Radio, Brain, BarChart3, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  instruction: string;
  targetSelector: string; // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: <Settings className="w-5 h-5" />,
    title: 'Configure Nodes',
    instruction: 'Start here to set up your analysis topics. These "nodes" define what themes you want to track across your data.',
    targetSelector: '[data-tutorial="settings"]',
    position: 'top',
  },
  {
    icon: <Radio className="w-5 h-5" />,
    title: 'Scrape Reddit',
    instruction: 'Collect sentiment data from research communities on Reddit. Configure subreddits, time range, and hit scrape.',
    targetSelector: '[data-tutorial="scanner"]',
    position: 'bottom',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: 'Or Academic Papers',
    instruction: 'Alternatively, scrape academic papers from arXiv and Semantic Scholar. Search by keywords or authors.',
    targetSelector: '[data-tutorial="papers"]',
    position: 'bottom',
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: 'Run Analysis',
    instruction: 'After scraping, click "Run Analysis" to process your data. AI will evaluate sentiment across all your nodes.',
    targetSelector: '[data-tutorial="analysis"]',
    position: 'top',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'View Results',
    instruction: 'Explore sentiment scores, trends, and key insights. Results are organized by your configured analysis nodes.',
    targetSelector: '[data-tutorial="archive"]',
    position: 'top',
  },
];

const STEP_DISPLAY_TIME = 4000; // ms to show each step

interface TutorialSequenceProps {
  onComplete: () => void;
  currentView: 'modeSelector' | 'scanner' | 'papers' | 'analysis' | 'settings' | null;
}

export function TutorialSequence({ onComplete, currentView }: TutorialSequenceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  // Calculate position of target element
  const updateTargetPosition = useCallback(() => {
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return;

    const target = document.querySelector(step.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      setHighlightRect(rect);

      // Position tooltip based on step configuration
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;

      switch (step.position) {
        case 'top':
          y = rect.top - 20;
          break;
        case 'bottom':
          y = rect.bottom + 20;
          break;
        case 'left':
          x = rect.left - 20;
          break;
        case 'right':
          x = rect.right + 20;
          break;
      }

      setTooltipPosition({ x, y });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateTargetPosition();
    
    // Update on resize
    window.addEventListener('resize', updateTargetPosition);
    
    // Also poll for element changes (for dynamic content)
    const interval = setInterval(updateTargetPosition, 500);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      clearInterval(interval);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
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

  const step = TUTORIAL_STEPS[currentStep];
  const hasTarget = highlightRect !== null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dimmed overlay with cutout for highlighted element */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="tutorial-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {hasTarget && (
                <rect
                  x={highlightRect.left - 8}
                  y={highlightRect.top - 8}
                  width={highlightRect.width + 16}
                  height={highlightRect.height + 16}
                  rx="12"
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
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#tutorial-mask)"
          />
        </svg>
      </div>

      {/* Highlight border around target */}
      {hasTarget && (
        <div
          className="absolute border-2 border-primary rounded-xl pointer-events-none transition-all duration-300 animate-pulse"
          style={{
            left: highlightRect.left - 8,
            top: highlightRect.top - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`
          absolute pointer-events-auto
          transition-all duration-500 ease-out
          ${hasTarget ? 'opacity-100 translate-y-0' : 'opacity-100'}
        `}
        style={{
          left: hasTarget 
            ? step.position === 'left' 
              ? highlightRect!.left - 320 
              : step.position === 'right'
                ? highlightRect!.right + 20
                : highlightRect!.left + highlightRect!.width / 2 - 150
            : '50%',
          top: hasTarget
            ? step.position === 'top'
              ? highlightRect!.top - 180
              : step.position === 'bottom'
                ? highlightRect!.bottom + 20
                : highlightRect!.top + highlightRect!.height / 2 - 80
            : '50%',
          transform: hasTarget ? 'none' : 'translate(-50%, -50%)',
        }}
      >
        <div className="w-[300px] bg-card/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border/30">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              {step.icon}
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
              </div>
              <div className="font-medium text-foreground">
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
          <div className="flex justify-center gap-1.5 pb-3">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  index === currentStep 
                    ? 'bg-primary' 
                    : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-muted'
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
              className="gap-1"
            >
              {currentStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Done'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
