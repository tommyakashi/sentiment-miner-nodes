import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Activity, Loader2, Zap } from 'lucide-react';
import { User, Session } from '@supabase/supabase-js';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Redirect to home if authenticated
        if (session?.user) {
          setTimeout(() => navigate('/'), 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        
        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Account created! You can now sign in.',
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Signed in successfully!',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Particle Background */}
      <ParticleBackground particleCount={35} interactive={true} />
      
      {/* Grid Overlay */}
      <div className="fixed inset-0 observatory-grid pointer-events-none z-0" />
      
      {/* Auth Card */}
      <Card className="w-full max-w-md p-8 relative z-10 bg-card/90 backdrop-blur-md border-border/50 animate-fade-in-up">
        {/* Gradient Border Effect */}
        <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-br from-primary/50 via-transparent to-accent/50 -z-10" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-6">
            <div className="p-4 bg-gradient-to-br from-primary to-accent rounded-xl glow-primary">
              <Activity className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Research Sentiment</span>
          </h1>
          <h2 className="text-2xl font-semibold text-foreground">Observatory</h2>
          <p className="text-muted-foreground mt-3 text-sm font-mono">
            {isSignUp ? 'Create your research account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="researcher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity gap-2" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignUp ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
            disabled={isLoading}
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      </Card>
    </div>
  );
}
