import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FadeTransition } from '@/components/PageTransition';
import { iosSpring, iosBounce } from '@/lib/animations';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error, isAdmin } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Welcome back!');
          navigate(isAdmin ? '/admin' : '/home');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(error.message);
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Universe-themed ambient background matching splash screen */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary cosmic glow */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(211 100% 50% / 0.3), transparent 60%)',
            filter: 'blur(60px)',
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.4, 0.6, 0.4],
            x: [-50, 50, -50],
            y: [-30, 30, -30],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Secondary pink glow */}
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(328 100% 54% / 0.25), transparent 60%)',
            filter: 'blur(60px)',
          }}
          animate={{
            scale: [1.3, 1, 1.3],
            opacity: [0.3, 0.5, 0.3],
            x: [30, -30, 30],
            y: [20, -20, 20],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        {/* Tertiary purple glow */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(270 100% 60% / 0.2), transparent 60%)',
            filter: 'blur(80px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        {/* Shooting Stars */}
        {[...Array(4)].map((_, i) => {
          const startX = Math.random() * 80 + 10;
          const startY = Math.random() * 30;
          const duration = 1.5 + Math.random() * 1;
          const delay = i * 1.5 + Math.random() * 2;
          
          return (
            <motion.div
              key={`shooting-star-${i}`}
              className="absolute"
              style={{
                top: `${startY}%`,
                left: `${startX}%`,
                width: '80px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(200,220,255,1))',
                borderRadius: '50%',
                filter: 'blur(0.5px)',
                boxShadow: '0 0 6px 2px rgba(200,220,255,0.6)',
              }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 35, scale: 0.5 }}
              animate={{
                x: [0, 250],
                y: [0, 180],
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1, 0.3],
              }}
              transition={{
                duration: duration,
                delay: delay,
                repeat: Infinity,
                repeatDelay: 4 + Math.random() * 4,
                ease: "easeOut",
              }}
            />
          );
        })}

        {/* Twinkling stars background */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
            }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity }}
          />
        ))}
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={iosSpring}
      >
        {/* Universe Logo matching splash screen */}
        <motion.div 
          className="flex flex-col items-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...iosSpring, delay: 0.1 }}
        >
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={iosBounce}
          >
            {/* Outer cosmic ring */}
            <motion.div
              className="absolute -inset-4 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, hsl(211 100% 60%), hsl(270 80% 60%), hsl(328 100% 60%), hsl(211 100% 60%))',
                opacity: 0.4,
                filter: 'blur(6px)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Orbital ring with stars */}
            <motion.div
              className="absolute -inset-3 rounded-full border border-white/20"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              {[0, 120, 240].map((angle, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-white"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${angle}deg) translateX(calc(50% + 16px)) translateY(-50%)`,
                    boxShadow: '0 0 8px 2px rgba(255,255,255,0.8)',
                  }}
                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                />
              ))}
            </motion.div>

            {/* Main galaxy sphere logo */}
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center relative overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #1a1a2e 0%, #0f0f1a 50%, #000000 100%)',
                boxShadow: '0 0 40px 15px rgba(100,150,255,0.3), inset 0 0 30px rgba(100,150,255,0.2)',
              }}
              animate={{
                boxShadow: [
                  '0 0 40px 15px rgba(100,150,255,0.3), inset 0 0 30px rgba(100,150,255,0.2)',
                  '0 0 60px 20px rgba(150,100,255,0.4), inset 0 0 40px rgba(150,100,255,0.3)',
                  '0 0 40px 15px rgba(100,150,255,0.3), inset 0 0 30px rgba(100,150,255,0.2)',
                ]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Galaxy spiral */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(100,150,255,0.15) 60deg, transparent 120deg, rgba(200,100,255,0.1) 180deg, transparent 240deg, rgba(255,100,150,0.1) 300deg, transparent 360deg)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Nebula clouds */}
              <div
                className="absolute inset-2 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse at 30% 40%, rgba(100,150,255,0.3) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(200,100,255,0.2) 0%, transparent 40%)',
                  filter: 'blur(6px)',
                }}
              />
              
              {/* Star field inside logo */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: Math.random() * 1.5 + 0.5 + 'px',
                    height: Math.random() * 1.5 + 0.5 + 'px',
                    top: 10 + Math.random() * 80 + '%',
                    left: 10 + Math.random() * 80 + '%',
                  }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
                />
              ))}

              {/* Central bright core */}
              <motion.div
                className="absolute w-10 h-10 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 40% 40%, #ffffff 0%, #a0c4ff 20%, #6b8cff 40%, transparent 70%)',
                  filter: 'blur(3px)',
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Universe "U" symbol */}
              <motion.svg
                width="36"
                height="36"
                viewBox="0 0 64 64"
                className="relative z-10"
              >
                <defs>
                  <linearGradient id="uGradientAuth" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#a0c4ff" />
                    <stop offset="100%" stopColor="#c4a0ff" />
                  </linearGradient>
                  <filter id="glowAuth">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d="M18 18 L18 38 C18 48 26 54 32 54 C38 54 46 48 46 38 L46 18"
                  stroke="url(#uGradientAuth)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#glowAuth)"
                />
              </motion.svg>
            </motion.div>
          </motion.div>
          
          <motion.h1 
            className="mt-6 text-3xl font-bold tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="gradient-text">Univers</span>
            <span className="text-white ml-2">Flow</span>
          </motion.h1>
          <motion.p
            className="mt-2 text-muted-foreground text-sm font-medium tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Premium Music Experience
          </motion.p>
        </motion.div>

        {/* iOS-style form card */}
        <motion.form 
          onSubmit={handleSubmit} 
          className="relative rounded-3xl p-8 space-y-6"
          style={{
            background: 'rgba(28, 28, 30, 0.8)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...iosSpring, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div 
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, x: isLogin ? -30 : 30, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: isLogin ? 30 : -30, scale: 0.98 }}
              transition={iosSpring}
            >
              <h2 className="text-2xl font-bold mb-1">{isLogin ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-muted-foreground text-sm">{isLogin ? 'Sign in to continue your music journey' : 'Start your premium music experience'}</p>
            </motion.div>
          </AnimatePresence>

          <div className="space-y-4 pt-2">
            {/* Email input - iOS style */}
            <motion.div 
              className="relative"
              animate={{
                scale: focusedField === 'email' ? 1.01 : 1,
              }}
              transition={iosBounce}
            >
              <motion.div
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                animate={{
                  color: focusedField === 'email' ? 'hsl(211 100% 50%)' : 'hsl(0 0% 55%)',
                  scale: focusedField === 'email' ? 1.1 : 1,
                }}
                transition={iosBounce}
              >
                <Mail className="w-5 h-5" />
              </motion.div>
              <Input 
                type="email" 
                placeholder="Email address" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                className="pl-12 h-14 text-base rounded-2xl border-0 bg-white/[0.06] focus:bg-white/[0.1] focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                required 
              />
            </motion.div>
            
            {/* Password input - iOS style */}
            <motion.div 
              className="relative"
              animate={{
                scale: focusedField === 'password' ? 1.01 : 1,
              }}
              transition={iosBounce}
            >
              <motion.div
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                animate={{
                  color: focusedField === 'password' ? 'hsl(211 100% 50%)' : 'hsl(0 0% 55%)',
                  scale: focusedField === 'password' ? 1.1 : 1,
                }}
                transition={iosBounce}
              >
                <Lock className="w-5 h-5" />
              </motion.div>
              <Input 
                type={showPassword ? 'text' : 'password'}
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                className="pl-12 pr-12 h-14 text-base rounded-2xl border-0 bg-white/[0.06] focus:bg-white/[0.1] focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                required 
                minLength={6} 
              />
              <motion.button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </motion.button>
            </motion.div>
          </div>

          {/* iOS-style submit button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={iosBounce}
          >
            <Button 
              type="submit" 
              className="w-full h-14 text-base font-semibold rounded-2xl border-0"
              style={{
                background: 'linear-gradient(135deg, hsl(211 100% 50%), hsl(328 100% 54%))',
                boxShadow: '0 8px 30px -5px hsl(211 100% 50% / 0.4)',
              }}
              disabled={loading}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.span 
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              )}
            </Button>
          </motion.div>

          {/* Toggle link */}
          <motion.p 
            className="text-center text-sm text-muted-foreground pt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <motion.button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-primary font-semibold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </motion.button>
          </motion.p>
        </motion.form>
      </motion.div>
      </div>
    </FadeTransition>
  );
};

export default Auth;
