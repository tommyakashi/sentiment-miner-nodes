import { Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AnalysisLoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  status: string;
  currentStep: number;
  totalSteps: number;
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
  totalSteps
}: AnalysisLoadingOverlayProps) {
  if (!isVisible) return null;

  const stepLabel = STEP_LABELS[currentStep - 1] || status || 'Processing...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm animate-fade-in" />
      
      {/* Loading card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-scale-in">
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-2xl animate-pulse" />
          
          {/* Card */}
          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
            {/* Animated icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary/30 animate-ping" />
              </div>
            </div>
            
            {/* Step indicator */}
            <div className="text-center mb-2">
              <span className="text-xs font-mono text-muted-foreground">
                Step {currentStep} of {totalSteps}
              </span>
            </div>
            
            {/* Status text */}
            <p className="text-center text-foreground font-medium mb-6">
              {stepLabel}
            </p>
            
            {/* Step dots */}
            <div className="flex justify-center gap-2 mb-6">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div 
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i + 1 < currentStep 
                      ? 'bg-primary' 
                      : i + 1 === currentStep 
                        ? 'bg-primary animate-pulse scale-125' 
                        : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            
            {/* Progress bar */}
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-mono">{status || 'Processing'}</span>
                <span className="text-sm font-mono text-primary font-semibold">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
