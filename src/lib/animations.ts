import type { Transition } from 'framer-motion';

// iOS-optimized spring animations - smooth, responsive, no lag
// Lower mass = faster response, higher stiffness = snappier
export const iosSpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.5,
};

export const iosBounce: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 25,
  mass: 0.3,
};

// Quick tap response - for button presses
export const iosTap: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 30,
  mass: 0.2,
};

export const iosGentle: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
  mass: 1,
};

export const iosTiming: Transition = {
  type: "tween",
  duration: 0.35,
  ease: [0.25, 0.1, 0.25, 1],
};

// Page transition variants
export const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: iosSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -10,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

// Stagger children animations
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: iosSpring,
  },
};

// Card/Item animations
export const cardVariants = {
  initial: { opacity: 0, y: 30, scale: 0.9 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: iosSpring,
  },
  hover: {
    y: -4,
    scale: 1.02,
    transition: iosBounce,
  },
  tap: {
    scale: 0.97,
    transition: { duration: 0.1 },
  },
};

// Modal/Sheet animations (iOS style slide up)
export const sheetVariants = {
  initial: {
    y: "100%",
    opacity: 0.5,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

// Fade scale (for modals, popovers)
export const fadeScaleVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: iosSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// List item slide in
export const listItemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: iosSpring,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.15 },
  },
};

// Tab indicator animation
export const tabIndicatorVariants = {
  transition: {
    type: "spring",
    stiffness: 500,
    damping: 35,
  },
};

// Blur backdrop
export const backdropVariants = {
  initial: { opacity: 0, backdropFilter: "blur(0px)" },
  animate: {
    opacity: 1,
    backdropFilter: "blur(20px)",
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: 0.2 },
  },
};

// Scale press effect (like iOS button press)
export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.96 },
  transition: iosBounce,
};

// Haptic-like feedback bounce - iOS feel
export const hapticBounce = {
  whileTap: {
    scale: [1, 0.92, 1],
    transition: { duration: 0.15 },
  },
};

// GPU-accelerated press effect for mobile
export const mobilePress = {
  whileTap: { 
    scale: 0.95,
    transition: iosTap,
  },
};

// Origin OS style elastic bounce
export const elasticBounce: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 20,
  mass: 0.6,
};

// Smooth page transitions for mobile
export const mobilePageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: iosSpring,
  },
  exit: { 
    opacity: 0, 
    y: -5,
    transition: { duration: 0.15 },
  },
};

// ====== NEW iOS 18 / Origin OS 6 Style Animations ======

// Ultra-smooth Origin OS 6 spring (like vivo's signature feel)
export const originOS6Spring: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 28,
  mass: 0.8,
  restDelta: 0.001,
};

// Magnetic snap effect (for toggles, sliders)
export const magneticSnap: Transition = {
  type: "spring",
  stiffness: 800,
  damping: 35,
  mass: 0.3,
};

// Fluid gesture transition (for swipe actions)
export const fluidGesture: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
  mass: 0.5,
  velocity: 2,
};

// iOS 18 style rubber band effect
export const rubberBand: Transition = {
  type: "spring",
  stiffness: 250,
  damping: 18,
  mass: 0.7,
};

// Micro-interaction bounce (for icons, badges)
export const microBounce: Transition = {
  type: "spring",
  stiffness: 900,
  damping: 15,
  mass: 0.2,
};

// Smooth reveal animation for lists
export const smoothReveal = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: originOS6Spring,
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

// Blur fade transition (like iOS app switcher)
export const blurFade = {
  initial: { 
    opacity: 0, 
    scale: 0.92,
    filter: "blur(10px)",
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...originOS6Spring,
      filter: { duration: 0.3 },
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    filter: "blur(5px)",
    transition: { duration: 0.2 },
  },
};

// Icon pop animation
export const iconPop = {
  whileTap: {
    scale: [1, 1.2, 0.9, 1.1, 1],
    transition: { duration: 0.4 },
  },
};

// Glow pulse animation for active states
export const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(255, 45, 85, 0)",
      "0 0 20px 4px rgba(255, 45, 85, 0.3)",
      "0 0 0 0 rgba(255, 45, 85, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Stack card animation (for album art)
export const stackCard = {
  initial: { scale: 0.8, rotateY: -15, opacity: 0 },
  animate: { 
    scale: 1, 
    rotateY: 0, 
    opacity: 1,
    transition: originOS6Spring,
  },
};

// Slide up sheet (enhanced iOS style)
export const slideUpSheet = {
  initial: { 
    y: "100%", 
    opacity: 0.8,
    scale: 0.95,
  },
  animate: { 
    y: 0, 
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 35,
      mass: 0.8,
    },
  },
  exit: { 
    y: "100%", 
    opacity: 0,
    transition: { 
      type: "spring",
      stiffness: 400,
      damping: 40,
    },
  },
};

// Parallax scroll effect parameters
export const parallaxScroll = {
  slow: 0.3,
  medium: 0.5,
  fast: 0.8,
};

// Floating animation (for FABs, badges)
export const floating = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Press and hold animation
export const pressAndHold = {
  whileTap: {
    scale: 0.92,
    transition: { duration: 0.1 },
  },
};

// Stagger grid animation
export const staggerGrid = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerGridItem = {
  initial: { opacity: 0, scale: 0.9, y: 15 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: originOS6Spring,
  },
};

// Shimmer loading effect
export const shimmer = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// Notification badge pop
export const badgePop = {
  initial: { scale: 0, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: microBounce,
  },
  exit: { 
    scale: 0, 
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// Swipe action reveal
export const swipeReveal = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: fluidGesture,
  },
};
