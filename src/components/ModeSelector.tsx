import { Radio, BarChart3, History, Upload, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModeId = 'scanner' | 'analysis' | 'archive' | 'upload' | 'settings';

interface Mode {
  id: ModeId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const modes: Mode[] = [
  { 
    id: 'scanner', 
    label: 'Reddit Scraper', 
    description: 'Collect signals from research communities',
    icon: <Radio className="w-6 h-6" />
  },
  { 
    id: 'analysis', 
    label: 'Analysis', 
    description: 'View sentiment insights and KPIs',
    icon: <BarChart3 className="w-6 h-6" />
  },
  { 
    id: 'archive', 
    label: 'Archive', 
    description: 'Browse historical scrape data',
    icon: <History className="w-6 h-6" />
  },
  { 
    id: 'upload', 
    label: 'Manual Upload', 
    description: 'Import interviews and custom data',
    icon: <Upload className="w-6 h-6" />
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    description: 'Configure analysis nodes',
    icon: <Settings className="w-6 h-6" />
  },
];

interface ModeSelectorProps {
  onSelectMode: (mode: ModeId) => void;
  isVisible: boolean;
}

export function ModeSelector({ onSelectMode, isVisible }: ModeSelectorProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "relative z-10 w-full max-w-4xl mx-auto px-4",
      "transition-all duration-500",
      isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
    )}>
      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold gradient-text mb-3">
          Sentiment Observatory
        </h1>
        <p className="text-muted-foreground text-sm">
          Select a mode to begin
        </p>
      </div>

      {/* Mode Cards Grid - 3 on top, 2 centered below */}
      <div className="flex flex-col gap-4">
        {/* Top row - 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {modes.slice(0, 3).map((mode) => (
            <ModeCard key={mode.id} mode={mode} onSelect={onSelectMode} />
          ))}
        </div>
        
        {/* Bottom row - 2 cards centered */}
        <div className="flex justify-center gap-4">
          {modes.slice(3).map((mode) => (
            <div key={mode.id} className="w-full sm:w-[calc(33.333%-0.5rem)]">
              <ModeCard mode={mode} onSelect={onSelectMode} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ModeCardProps {
  mode: Mode;
  onSelect: (mode: ModeId) => void;
}

function ModeCard({ mode, onSelect }: ModeCardProps) {
  return (
    <button
      onClick={() => onSelect(mode.id)}
      className={cn(
        "bg-card/45 backdrop-blur-2xl rounded-xl border border-white/10",
        "shadow-2xl p-6 cursor-pointer",
        "hover:scale-105 hover:border-primary/30",
        "transition-all duration-300 group w-full",
        "focus:outline-none focus:ring-2 focus:ring-primary/50"
      )}
    >
      {/* Inner glow on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="relative text-center space-y-3">
        {/* Icon container */}
        <div className={cn(
          "w-14 h-14 mx-auto rounded-full",
          "bg-primary/10 border border-primary/20",
          "flex items-center justify-center",
          "group-hover:bg-primary/20 group-hover:border-primary/40",
          "transition-all duration-300"
        )}>
          <span className="text-primary group-hover:scale-110 transition-transform">
            {mode.icon}
          </span>
        </div>
        
        {/* Label */}
        <h3 className="font-semibold text-foreground text-base">
          {mode.label}
        </h3>
        
        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {mode.description}
        </p>
      </div>
    </button>
  );
}
