import { Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AnalysisLoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  status: string;
}

export function AnalysisLoadingOverlay({ isVisible, progress, status }: AnalysisLoadingOverlayProps) {
  if (!isVisible) return null;

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
            
            {/* Status text */}
            <p className="text-center text-foreground font-medium mb-6">
              {status || 'Analyzing sentiment...'}
            </p>
            
            {/* Progress bar */}
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-mono">Processing</span>
                <span className="text-sm font-mono text-primary font-semibold">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
