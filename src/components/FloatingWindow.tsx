import { ReactNode } from 'react';

interface FloatingWindowProps {
  children: ReactNode;
  header?: ReactNode;
}

export function FloatingWindow({ children, header }: FloatingWindowProps) {
  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Window shadow/glow - subtle */}
      <div className="absolute -inset-1 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-xl blur-xl opacity-30" />
      
      {/* Main window - very transparent */}
      <div className="relative bg-card/45 backdrop-blur-2xl rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />
        
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
