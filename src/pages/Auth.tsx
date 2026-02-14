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
import appLogo from '@/assets/app-logo.png';

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
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-5 relative overflow-hidden">
        {/* Animated gradient orbs — matching splash screen */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, hsl(340 100% 50% / 0.3), transparent 60%)',
            filter: 'blur(100px)',
          }}
          initial={{ x: '-30%', y: '-40%', scale: 0.6, opacity: 0 }}
          animate={{ x: '-20%', y: '-30%', scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, hsl(260 100% 60% / 0.25), transparent 60%)',
            filter: 'blur(100px)',
          }}
          initial={{ x: '30%', y: '40%', scale: 0.6, opacity: 0 }}
          animate={{ x: '20%', y: '30%', scale: 1, opacity: 1 }}
          transition={{ duration: 2, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, hsl(210 100% 60% / 0.15), transparent 60%)',
            filter: 'blur(80px)',
          }}
          initial={{ x: '10%', y: '-10%', scale: 0.5, opacity: 0 }}
          animate={{ x: '15%', y: '-15%', scale: 1.2, opacity: 1 }}
          transition={{ duration: 2.5, ease: 'easeOut', delay: 0.4 }}
        />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        <motion.div
          className="relative w-full max-w-sm z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Logo — matching splash screen */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              className="relative"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Outer glow ring */}
              <motion.div
                className="absolute -inset-4 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, hsl(340 100% 50% / 0.35), hsl(260 100% 60% / 0.25), hsl(210 100% 60% / 0.25), hsl(340 100% 50% / 0.35))',
                  filter: 'blur(18px)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <div
                className="w-24 h-24 rounded-full overflow-hidden relative"
                style={{
                  border: '1.5px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 0 50px 8px hsl(260 100% 60% / 0.2), 0 0 100px 20px hsl(340 100% 50% / 0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <img src={appLogo} alt="UniversFlow" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            <motion.h1
              className="mt-5 text-3xl font-bold tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #FF2D55, #BF5AF2, #5E5CE6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Univers
              </span>
              <span className="text-foreground ml-1.5 font-light">Flow</span>
            </motion.h1>
            <motion.p
              className="mt-1.5 text-[12px] tracking-[0.15em] uppercase font-medium text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Premium Music Experience
            </motion.p>
          </div>

          {/* Form card — glassmorphism */}
          <motion.form
            onSubmit={handleSubmit}
            className="relative rounded-3xl p-6 space-y-5"
            style={{
              background: 'rgba(28, 28, 30, 0.75)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div>
              <h2 className="text-xl font-bold mb-0.5 text-foreground">{isLogin ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-muted-foreground text-xs">{isLogin ? 'Sign in to continue' : 'Start your music journey'}</p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 text-sm rounded-xl border-0"
                  style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 text-sm rounded-xl border-0"
                  style={{ background: 'rgba(255, 255, 255, 0.06)' }}
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

            {/* Submit button — premium gradient */}
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                className="w-full h-12 text-sm font-bold rounded-xl border-0 text-primary-foreground"
                style={{
                  background: 'linear-gradient(135deg, #FF2D55, #BF5AF2, #5E5CE6)',
                  boxShadow: '0 4px 20px hsl(340 100% 50% / 0.35), 0 8px 40px hsl(260 100% 60% / 0.2)',
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
            </motion.div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[10px] text-muted-foreground/60">or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Google */}
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-sm font-medium rounded-xl border-0"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/home` },
                  });
                  if (error) toast.error('Failed to sign in with Google');
                }}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>
            </motion.div>

            {/* Toggle */}
            <p className="text-center text-xs text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-bold active:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #FF2D55, #BF5AF2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </motion.form>
        </motion.div>

        {/* Footer credit */}
        <motion.div
          className="absolute bottom-5 z-10 px-4 py-1.5 rounded-full flex items-center gap-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#FF2D55', boxShadow: '0 0 8px #FF2D55' }}
          />
          <p className="text-[10px] text-muted-foreground/50 tracking-wider">
            Crafted by <span className="text-muted-foreground/80 font-semibold">SHASHANK YADAV</span>
          </p>
        </motion.div>
      </div>
    </FadeTransition>
  );
};

export default Auth;
