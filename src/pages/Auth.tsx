import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FadeTransition } from '@/components/PageTransition';
import { getAuthError } from '@/lib/errorMessages';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error, isAdmin } = await signIn(email, password);
        if (error) {
          toast.error(getAuthError(error));
        } else {
          toast.success('Welcome back!');
          navigate(isAdmin ? '/admin' : '/home');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(getAuthError(error));
        } else {
          toast.success('Account created successfully!');
          navigate('/home');
        }
      }
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeTransition>
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Simple gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full opacity-30"
            style={{
              background: 'radial-gradient(circle, hsl(211 100% 50% / 0.4), transparent 60%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, hsl(328 100% 54% / 0.3), transparent 60%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        <motion.div
          className="relative w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Compact Logo */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center relative"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #1a1a2e 0%, #0f0f1a 50%, #000000 100%)',
                boxShadow: '0 0 30px 8px rgba(100,150,255,0.25)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 64 64">
                <defs>
                  <linearGradient id="uGradientAuth" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#a0c4ff" />
                    <stop offset="100%" stopColor="#c4a0ff" />
                  </linearGradient>
                </defs>
                <path
                  d="M18 18 L18 38 C18 48 26 54 32 54 C38 54 46 48 46 38 L46 18"
                  stroke="url(#uGradientAuth)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            
            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              <span className="gradient-text">Univers</span>
              <span className="text-white ml-1.5">Flow</span>
            </h1>
            <p className="mt-1 text-muted-foreground text-xs font-medium tracking-wide">
              Premium Music Experience
            </p>
          </div>

          {/* Compact Form card */}
          <form 
            onSubmit={handleSubmit} 
            className="relative rounded-2xl p-5 space-y-4"
            style={{
              background: 'rgba(28, 28, 30, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div>
              <h2 className="text-xl font-bold mb-0.5">{isLogin ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-muted-foreground text-xs">{isLogin ? 'Sign in to continue' : 'Start your music journey'}</p>
            </div>

            <div className="space-y-3">
              {/* Email input */}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="email" 
                  placeholder="Email address" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="pl-10 h-11 text-sm rounded-xl border-0 bg-white/[0.06] focus:bg-white/[0.1] focus:ring-2 focus:ring-primary/50"
                  required 
                />
              </div>
              
              {/* Password input */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 text-sm rounded-xl border-0 bg-white/[0.06] focus:bg-white/[0.1] focus:ring-2 focus:ring-primary/50"
                  required 
                  minLength={6} 
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground active:scale-90 transition-transform"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <Button 
              type="submit" 
              className="w-full h-11 text-sm font-semibold rounded-xl border-0 active:scale-[0.98] transition-transform"
              style={{
                background: 'linear-gradient(135deg, hsl(211 100% 50%), hsl(328 100% 54%))',
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Google sign-in button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 text-sm font-medium rounded-xl border-white/10 bg-white/[0.06] active:scale-[0.98] transition-transform"
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/home`
                  }
                });
                if (error) {
                  toast.error('Failed to sign in with Google');
                }
              }}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>

            {/* Toggle link */}
            <p className="text-center text-xs text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)} 
                className="text-primary font-semibold active:opacity-70"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </motion.div>
        
        {/* Compact footer */}
        <p className="absolute bottom-4 text-[10px] text-muted-foreground/50">By SHASHANK YADAV</p>
      </div>
    </FadeTransition>
  );
};

export default Auth;