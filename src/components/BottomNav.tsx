import { motion } from 'framer-motion';
import { Home, Search, Library, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';
import { iosSpring, iosBounce } from '@/lib/animations';

const navItems = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: Search, label: 'Search', path: '/search' },
  { icon: Library, label: 'Library', path: '/library' },
  { icon: User, label: 'Profile', path: '/profile' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSong } = usePlayer();

  return (
    <motion.nav
      className={`fixed left-0 right-0 z-50 safe-area-pb ${
        currentSong ? 'bottom-[76px]' : 'bottom-0'
      }`}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...iosSpring, delay: 0.3 }}
      style={{ 
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}
    >
      <div className="flex items-center justify-around py-3 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.path}
              className="relative flex flex-col items-center gap-0.5 py-2 px-8 rounded-2xl"
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.85 }}
              transition={iosBounce}
            >
              <motion.div
                className="relative"
                animate={{
                  scale: isActive ? 1 : 0.95,
                  y: isActive ? -2 : 0,
                }}
                transition={iosSpring}
              >
                <Icon
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                  <motion.div
                    className="absolute -inset-3 rounded-2xl bg-primary/10"
                    layoutId="nav-glow"
                    transition={iosSpring}
                  />
                )}
              </motion.div>
              
              <motion.span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                animate={{ opacity: isActive ? 1 : 0.7 }}
              >
                {item.label}
              </motion.span>
              
              {isActive && (
                <motion.div
                  className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-primary"
                  layoutId="nav-indicator"
                  transition={iosSpring}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
