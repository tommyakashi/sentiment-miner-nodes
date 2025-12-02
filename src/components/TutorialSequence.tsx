import { useState, useEffect } from 'react';
import { Settings, Radio, Download, Brain, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: <Settings className="w-6 h-6" />,
    title: 'Configure Nodes',
    description: 'Set up analysis topics in Settings',
  },
  {
    icon: <Radio className="w-6 h-6" />,
    title: 'Choose Source',
    description: 'Reddit or Academic Papers',
  },
  {
    icon: <Download className="w-6 h-6" />,
    title: 'Scrape Data',
    description: 'Collect content automatically',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Analyze',
    description: 'AI-powered sentiment analysis',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'View Results',
    description: 'Explore insights & trends',
  },
];

const STEP_DURATION = 1200; // ms per step
const FADE_IN_DELAY = 400; // ms between step appearances

interface TutorialSequenceProps {
  onComplete: () => void;
}

export function TutorialSequence({ onComplete }: TutorialSequenceProps) {
  const [activeStep, setActiveStep] = useState(-1);
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Sequentially reveal steps
    const revealTimers: NodeJS.Timeout[] = [];
    
    TUTORIAL_STEPS.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleSteps(prev => [...prev, index]);
        setActiveStep(index);
      }, index * FADE_IN_DELAY);
      revealTimers.push(timer);
    });

    // Auto-complete after all steps shown + viewing time
    const completeTimer = setTimeout(() => {
      handleComplete();
    }, (TUTORIAL_STEPS.length * FADE_IN_DELAY) + STEP_DURATION);

    return () => {
      revealTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, []);

  const handleComplete = () => {
    setIsFadingOut(true);
    localStorage.setItem('tutorial-completed', 'true');
    setTimeout(onComplete, 500);
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Tutorial title */}
      <div 
        className={`mb-8 text-center transition-all duration-500 ${
          visibleSteps.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <h2 className="text-lg font-medium text-muted-foreground tracking-wide uppercase">
          Quick Start
        </h2>
      </div>

      {/* Steps container */}
      <div className="flex items-center gap-4">
        {TUTORIAL_STEPS.map((step, index) => {
          const isVisible = visibleSteps.includes(index);
          const isActive = activeStep === index;
          
          return (
            <div key={index} className="flex items-center">
              {/* Step box */}
              <div
                className={`
                  relative flex flex-col items-center justify-center
                  w-28 h-28 rounded-xl
                  bg-card/60 backdrop-blur-xl
                  border transition-all duration-500
                  ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                  ${isActive 
                    ? 'border-primary/60 shadow-[0_0_30px_rgba(255,255,255,0.15)]' 
                    : 'border-border/30'
                  }
                `}
                style={{
                  transitionDelay: `${index * 50}ms`,
                }}
              >
                {/* Glow effect for active step */}
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
                )}
                
                {/* Icon */}
                <div className={`
                  mb-2 transition-colors duration-300
                  ${isActive ? 'text-primary' : 'text-muted-foreground'}
                `}>
                  {step.icon}
                </div>
                
                {/* Title */}
                <span className={`
                  text-xs font-medium text-center px-2 transition-colors duration-300
                  ${isActive ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  {step.title}
                </span>
                
                {/* Description */}
                <span className="text-[10px] text-muted-foreground/70 text-center px-2 mt-1">
                  {step.description}
                </span>

                {/* Step number indicator */}
                <div className={`
                  absolute -top-2 -right-2 w-5 h-5 rounded-full
                  flex items-center justify-center text-[10px] font-medium
                  transition-all duration-300
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {index + 1}
                </div>
              </div>

              {/* Connector line */}
              {index < TUTORIAL_STEPS.length - 1 && (
                <div 
                  className={`
                    w-8 h-px mx-1 transition-all duration-500
                    ${visibleSteps.includes(index + 1) 
                      ? 'bg-border/50' 
                      : 'bg-transparent'
                    }
                  `}
                  style={{
                    transitionDelay: `${(index + 1) * FADE_IN_DELAY}ms`,
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
          mt-8 text-muted-foreground hover:text-foreground
          transition-all duration-500
          ${visibleSteps.length > 0 ? 'opacity-100' : 'opacity-0'}
        `}
      >
        Skip
      </Button>
    </div>
  );
}
