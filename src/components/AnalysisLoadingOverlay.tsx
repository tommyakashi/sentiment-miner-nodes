import { useEffect, useState } from 'react';

interface AnalysisLoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  status: string;
  currentStep: number;
  totalSteps: number;
  totalTexts?: number;
}

const STEP_LABELS = [
  'Initializing',
  'Preparing data',
  'Sending to AI',
  'Analyzing sentiment',
  'Aggregating results'
];

export function AnalysisLoadingOverlay({ 
  isVisible, 
  progress, 
  status,
  currentStep,
  totalSteps,
  totalTexts
}: AnalysisLoadingOverlayProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  
  // Smooth progress animation
  useEffect(() => {
    if (!isVisible) {
      setDisplayProgress(0);
      return;
    }
    
    const targetProgress = progress;
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= targetProgress) return targetProgress;
        // Smooth increment towards target
        const diff = targetProgress - prev;
        const increment = Math.max(0.5, diff * 0.1);
        return Math.min(prev + increment, targetProgress);
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [progress, isVisible]);

  if (!isVisible) return null;

  const stepLabel = STEP_LABELS[currentStep - 1] || status || 'Processing...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-fade-in" />
      
      {/* Loading card - Futuristic pill design */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-scale-in">
        <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 px-6 py-5 shadow-2xl">
          
          {/* Header with spinner */}
          <div className="flex items-center gap-3 mb-4">
            {/* Spinner */}
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-white rounded-full animate-spin" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-white/90">
              Analyzing Sentiment
            </span>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-white/50">
              Step {currentStep}/{totalSteps}
            </span>
            <span className="text-white/30">•</span>
            <span className="text-xs font-mono text-white/70">
              {stepLabel}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="relative mb-3">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-white/40">
              {totalTexts ? `${totalTexts} texts` : status || 'Processing'}
            </span>
            <span className="text-xs font-mono text-white/90 tabular-nums">
              {Math.round(displayProgress)}%
            </span>
          </div>
          
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 < currentStep 
                    ? 'bg-white' 
                    : i + 1 === currentStep 
                      ? 'bg-white/80' 
                      : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
