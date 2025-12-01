import { Radio, BarChart3, History, Upload, Settings, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModeId = 'scanner' | 'papers' | 'analysis' | 'archive' | 'upload' | 'settings';

interface Mode {
  id: ModeId;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const modes: Mode[] = [
  { 
    id: 'scanner', 
    label: 'Reddit Scraper', 
    description: 'Collect signals from research communities',
    icon: <Radio className="w-6 h-6" />,
    accent: 'orange'
  },
  { 
    id: 'papers', 
    label: 'Academic Papers', 
    description: 'Scrape research papers from arXiv & Semantic Scholar',
    icon: <BookOpen className="w-6 h-6" />,
    accent: 'blue'
  },
  { 
    id: 'analysis', 
    label: 'Analysis', 
    description: 'View sentiment insights and KPIs',
    icon: <BarChart3 className="w-6 h-6" />,
    accent: 'emerald'
  },
  { 
    id: 'archive', 
    label: 'Archive', 
    description: 'Browse historical scrape data',
    icon: <History className="w-6 h-6" />,
    accent: 'purple'
  },
  { 
    id: 'upload', 
    label: 'Manual Upload', 
    description: 'Import interviews and custom data',
    icon: <Upload className="w-6 h-6" />,
    accent: 'amber'
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    description: 'Configure analysis nodes',
    icon: <Settings className="w-6 h-6" />,
    accent: 'slate'
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
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-background/30 backdrop-blur-sm mb-4 opacity-0 animate-fade-in-slow"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">System Online</span>
        </div>
        <h1 
          className="text-4xl font-bold text-foreground mb-3 tracking-tight opacity-0 animate-fade-in-slow"
          style={{ animationDelay: '100ms' }}
        >
          Sentiment Observatory
        </h1>
        <p 
          className="text-muted-foreground text-sm font-mono opacity-0 animate-fade-in-slow"
          style={{ animationDelay: '200ms' }}
        >
          Select a module to begin
        </p>
      </div>

      {/* Mode Cards Grid */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {modes.slice(0, 3).map((mode, index) => (
            <ModeCard key={mode.id} mode={mode} onSelect={onSelectMode} index={index} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {modes.slice(3).map((mode, index) => (
            <ModeCard key={mode.id} mode={mode} onSelect={onSelectMode} index={index + 3} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ModeCardProps {
  mode: Mode;
  onSelect: (mode: ModeId) => void;
  index: number;
}

function ModeCard({ mode, onSelect, index }: ModeCardProps) {
  const accentClasses: Record<string, string> = {
    orange: 'group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]',
    blue: 'group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    emerald: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    purple: 'group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    amber: 'group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    slate: 'group-hover:border-slate-400/50 group-hover:shadow-[0_0_30px_rgba(148,163,184,0.1)]',
  };

  const iconBgClasses: Record<string, string> = {
    orange: 'bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20 group-hover:bg-purple-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20',
    slate: 'bg-slate-500/10 border-slate-500/20 group-hover:bg-slate-500/20',
  };

  const iconTextClasses: Record<string, string> = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400',
  };

  // Stagger delay: 150ms between each card, offset by 400ms to let header animate first
  const animationDelay = `${400 + index * 150}ms`;

  return (
    <button
      onClick={() => onSelect(mode.id)}
      className={cn(
        "relative bg-card/60 backdrop-blur-sm rounded-xl border border-border/50",
        "p-6 cursor-pointer group w-full text-left",
        "hover:bg-card/80 transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "opacity-0 animate-fade-in-slow",
        accentClasses[mode.accent]
      )}
      style={{ animationDelay }}
    >
      <div className="space-y-4">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-lg border flex items-center justify-center transition-all duration-300",
          iconBgClasses[mode.accent]
        )}>
          <span className={cn("transition-transform group-hover:scale-110", iconTextClasses[mode.accent])}>
            {mode.icon}
          </span>
        </div>
        
        {/* Content */}
        <div>
          <h3 className="font-semibold text-foreground text-base mb-1 flex items-center gap-2">
            {mode.label}
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {mode.description}
          </p>
        </div>
      </div>
    </button>
  );
}
