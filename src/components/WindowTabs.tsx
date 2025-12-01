import { cn } from '@/lib/utils';
import { X, Plus, Radio, History, Settings, BarChart3, Upload, Home, BookOpen } from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';

export type TabId = 'scanner' | 'papers' | 'papers-archive' | 'papers-analysis' | 'archive' | 'analysis' | 'upload' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'scanner', label: 'Signal Scanner', icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'papers', label: 'Paper Scanner', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'archive', label: 'Archive', icon: <History className="w-3.5 h-3.5" /> },
  { id: 'papers-archive', label: 'Paper Archive', icon: <History className="w-3.5 h-3.5" /> },
  { id: 'analysis', label: 'Analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'papers-analysis', label: 'Paper Analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'upload', label: 'Manual Upload', icon: <Upload className="w-3.5 h-3.5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
];

interface WindowTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  dataCount?: number;
  onBackToHome?: () => void;
}

export function WindowTabs({ activeTab, onTabChange, dataCount = 0, onBackToHome }: WindowTabsProps) {
  return (
    <div className="flex items-center bg-[hsl(230,15%,8%)] rounded-t-xl border-b border-border/30">
      {/* Window Controls / Home Button */}
      <div className="flex items-center gap-2 px-4 py-3">
        {onBackToHome ? (
          <button
            onClick={onBackToHome}
            className="w-7 h-7 rounded-full bg-muted/50 hover:bg-primary/20 transition-all flex items-center justify-center group"
            title="Back to home"
          >
            <Home className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0.5 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all",
                "rounded-t-lg min-w-[120px] max-w-[200px]",
                isActive
                  ? "bg-card text-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {/* Active tab glow */}
              {isActive && (
                <div className="absolute inset-x-0 -top-px h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
              )}
              
              <span className={cn(
                "transition-colors select-none",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {tab.icon}
              </span>
              
              <span className="truncate select-none">{tab.label}</span>
              
              {/* Data indicator for scanner tab */}
              {tab.id === 'scanner' && dataCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-primary/20 text-primary rounded">
                  {dataCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Animated Logo */}
      <div className="flex items-center px-4">
        <AnimatedLogo />
      </div>
    </div>
  );
}
