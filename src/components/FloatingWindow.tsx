import { ReactNode } from 'react';

interface FloatingWindowProps {
  children: ReactNode;
  header?: ReactNode;
}

export function FloatingWindow({ children, header }: FloatingWindowProps) {
  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Window shadow/glow */}
      <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 rounded-xl blur-xl opacity-50" />
      
      {/* Main window */}
      <div className="relative bg-card/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        {/* Header (tabs) */}
        {header}
        
        {/* Content */}
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  );
}
