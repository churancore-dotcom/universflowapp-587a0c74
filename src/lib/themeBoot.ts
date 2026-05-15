// Applies the saved theme tokens to :root BEFORE React mounts.
// This guarantees the theme persists across reloads and is consistent
// across every page (not just Settings).
//
// Each theme defines a COMPLETE token set so no element renders unstyled
// in any mode (Pearl/white especially).

type ThemeMode = 'default' | 'light' | 'black' | 'sunset' | 'ocean' | 'midnight-gold' | 'crimson';

interface ThemeTokens {
  background: string; foreground: string;
  card: string; cardForeground: string;
  muted: string; mutedForeground: string;
  popover: string; popoverForeground: string;
  secondary: string; secondaryForeground: string;
  border: string; input: string;
  primary: string; primaryForeground: string;
  accent: string; accentForeground: string;
  ring: string;
  destructive: string; destructiveForeground: string;
  // Sidebar / chart tokens (used by some shadcn primitives)
  sidebar: string; sidebarForeground: string;
  sidebarPrimary: string; sidebarPrimaryForeground: string;
  sidebarAccent: string; sidebarAccentForeground: string;
  sidebarBorder: string; sidebarRing: string;
  bodyBg: string;
  // For meta theme-color (status bar)
  statusBar: string;
}

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  // ====== Obsidian — refined deep black + neon rose (default) ======
  default: {
    background: '0 0% 0%', foreground: '0 0% 98%',
    card: '0 0% 7%', cardForeground: '0 0% 98%',
    muted: '0 0% 14%', mutedForeground: '0 0% 60%',
    popover: '0 0% 9%', popoverForeground: '0 0% 98%',
    secondary: '0 0% 11%', secondaryForeground: '0 0% 98%',
    border: '0 0% 16%', input: '0 0% 12%',
    primary: '350 100% 60%', primaryForeground: '0 0% 100%',
    accent: '330 100% 65%', accentForeground: '0 0% 100%',
    ring: '350 100% 60%',
    destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
    sidebar: '0 0% 5%', sidebarForeground: '0 0% 95%',
    sidebarPrimary: '350 100% 60%', sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '0 0% 12%', sidebarAccentForeground: '0 0% 95%',
    sidebarBorder: '0 0% 14%', sidebarRing: '350 100% 60%',
    bodyBg: '#000',
    statusBar: '#000000',
  },
  // ====== Pearl — TRUE crisp white, fully fixed ======
  light: {
    background: '0 0% 100%', foreground: '240 10% 8%',
    card: '0 0% 100%', cardForeground: '240 10% 8%',
    muted: '240 6% 96%', mutedForeground: '240 5% 38%',
    popover: '0 0% 100%', popoverForeground: '240 10% 8%',
    secondary: '240 6% 97%', secondaryForeground: '240 10% 8%',
    border: '240 6% 90%', input: '240 6% 94%',
    primary: '350 100% 50%', primaryForeground: '0 0% 100%',
    accent: '330 95% 56%', accentForeground: '0 0% 100%',
    ring: '350 100% 50%',
    destructive: '0 75% 52%', destructiveForeground: '0 0% 100%',
    sidebar: '0 0% 100%', sidebarForeground: '240 10% 8%',
    sidebarPrimary: '350 100% 50%', sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '240 6% 96%', sidebarAccentForeground: '240 10% 8%',
    sidebarBorder: '240 6% 88%', sidebarRing: '350 100% 50%',
    bodyBg: '#ffffff',
    statusBar: '#ffffff',
  },
  // ====== Onyx — pure black (OLED) ======
  black: {
    background: '0 0% 0%', foreground: '0 0% 98%',
    card: '0 0% 4%', cardForeground: '0 0% 98%',
    muted: '0 0% 8%', mutedForeground: '0 0% 58%',
    popover: '0 0% 5%', popoverForeground: '0 0% 98%',
    secondary: '0 0% 7%', secondaryForeground: '0 0% 98%',
    border: '0 0% 11%', input: '0 0% 7%',
    primary: '350 100% 60%', primaryForeground: '0 0% 100%',
    accent: '330 100% 65%', accentForeground: '0 0% 100%',
    ring: '350 100% 60%',
    destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
    sidebar: '0 0% 0%', sidebarForeground: '0 0% 95%',
    sidebarPrimary: '350 100% 60%', sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '0 0% 8%', sidebarAccentForeground: '0 0% 95%',
    sidebarBorder: '0 0% 10%', sidebarRing: '350 100% 60%',
    bodyBg: '#000',
    statusBar: '#000000',
  },
  // ====== Sunset Velvet — molten ORANGE on warm espresso (high impact) ======
  sunset: {
    background: '18 55% 7%', foreground: '30 40% 98%',
    card: '16 50% 11%', cardForeground: '30 40% 98%',
    muted: '16 35% 17%', mutedForeground: '28 25% 70%',
    popover: '16 50% 12%', popoverForeground: '30 40% 98%',
    secondary: '16 40% 15%', secondaryForeground: '30 40% 98%',
    border: '16 35% 22%', input: '16 38% 15%',
    primary: '20 100% 56%', primaryForeground: '0 0% 100%',
    accent: '335 100% 60%', accentForeground: '0 0% 100%',
    ring: '20 100% 56%',
    destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
    sidebar: '16 50% 8%', sidebarForeground: '30 40% 96%',
    sidebarPrimary: '20 100% 56%', sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '16 40% 15%', sidebarAccentForeground: '30 40% 96%',
    sidebarBorder: '16 35% 20%', sidebarRing: '20 100% 56%',
    bodyBg: 'radial-gradient(ellipse at top, #4a1a05 0%, #1f0d05 55%, #0d0604 100%)',
    statusBar: '#2a0f04',
  },
  // ====== Aurora — deep BLUE ocean × neon cyan (high impact) ======
  ocean: {
    background: '218 75% 7%', foreground: '210 40% 98%',
    card: '218 65% 11%', cardForeground: '210 40% 98%',
    muted: '218 45% 17%', mutedForeground: '210 25% 70%',
    popover: '218 65% 12%', popoverForeground: '210 40% 98%',
    secondary: '218 50% 15%', secondaryForeground: '210 40% 98%',
    border: '218 45% 22%', input: '218 48% 15%',
    primary: '205 100% 55%', primaryForeground: '218 75% 7%',
    accent: '178 95% 52%', accentForeground: '218 75% 7%',
    ring: '205 100% 55%',
    destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
    sidebar: '218 70% 8%', sidebarForeground: '210 40% 96%',
    sidebarPrimary: '205 100% 55%', sidebarPrimaryForeground: '218 75% 7%',
    sidebarAccent: '218 50% 15%', sidebarAccentForeground: '210 40% 96%',
    sidebarBorder: '218 45% 20%', sidebarRing: '205 100% 55%',
    bodyBg: 'radial-gradient(ellipse at top, #062a55 0%, #03132d 55%, #020812 100%)',
    statusBar: '#03132d',
  },
  // ====== Midnight Gold — luxe navy × warm gold ======
  'midnight-gold': {
    background: '240 28% 5%', foreground: '40 30% 98%',
    card: '240 22% 9%', cardForeground: '40 30% 98%',
    muted: '240 16% 14%', mutedForeground: '40 12% 65%',
    popover: '240 22% 11%', popoverForeground: '40 30% 98%',
    secondary: '240 16% 12%', secondaryForeground: '40 30% 98%',
    border: '240 18% 18%', input: '240 18% 12%',
    primary: '42 100% 58%', primaryForeground: '240 28% 5%',
    accent: '36 92% 60%', accentForeground: '240 28% 5%',
    ring: '42 100% 58%',
    destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
    sidebar: '240 26% 6%', sidebarForeground: '40 30% 96%',
    sidebarPrimary: '42 100% 58%', sidebarPrimaryForeground: '240 28% 5%',
    sidebarAccent: '240 16% 12%', sidebarAccentForeground: '40 30% 96%',
    sidebarBorder: '240 18% 17%', sidebarRing: '42 100% 58%',
    bodyBg: 'radial-gradient(ellipse at top, #1a1530 0%, #0a0915 55%, #050409 100%)',
    statusBar: '#0a0915',
  },
  // ====== Crimson — deep RED blood-velvet (high impact) ======
  crimson: {
    background: '350 60% 6%', foreground: '0 0% 98%',
    card: '350 55% 10%', cardForeground: '0 0% 98%',
    muted: '350 35% 16%', mutedForeground: '350 15% 70%',
    popover: '350 55% 11%', popoverForeground: '0 0% 98%',
    secondary: '350 40% 14%', secondaryForeground: '0 0% 98%',
    border: '350 35% 21%', input: '350 38% 14%',
    primary: '352 100% 56%', primaryForeground: '0 0% 100%',
    accent: '12 100% 58%', accentForeground: '0 0% 100%',
    ring: '352 100% 56%',
    destructive: '0 90% 55%', destructiveForeground: '0 0% 100%',
    sidebar: '350 55% 7%', sidebarForeground: '0 0% 96%',
    sidebarPrimary: '352 100% 56%', sidebarPrimaryForeground: '0 0% 100%',
    sidebarAccent: '350 40% 14%', sidebarAccentForeground: '0 0% 96%',
    sidebarBorder: '350 35% 20%', sidebarRing: '352 100% 56%',
    bodyBg: 'radial-gradient(ellipse at top, #4d0518 0%, #1f0309 55%, #0c0204 100%)',
    statusBar: '#1f0309',
  },
};

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  const t = THEMES[theme] || THEMES.default;

  // Toggle .light class on <html> for any CSS that gates on it
  if (theme === 'light') root.classList.add('light');
  else root.classList.remove('light');

  // Core surface tokens
  root.style.setProperty('--background', t.background);
  root.style.setProperty('--foreground', t.foreground);
  root.style.setProperty('--card', t.card);
  root.style.setProperty('--card-foreground', t.cardForeground);
  root.style.setProperty('--muted', t.muted);
  root.style.setProperty('--muted-foreground', t.mutedForeground);
  root.style.setProperty('--popover', t.popover);
  root.style.setProperty('--popover-foreground', t.popoverForeground);
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--secondary-foreground', t.secondaryForeground);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--input', t.input);

  // Brand
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-foreground', t.primaryForeground);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-foreground', t.accentForeground);
  root.style.setProperty('--ring', t.ring);
  root.style.setProperty('--destructive', t.destructive);
  root.style.setProperty('--destructive-foreground', t.destructiveForeground);

  // Sidebar
  root.style.setProperty('--sidebar-background', t.sidebar);
  root.style.setProperty('--sidebar-foreground', t.sidebarForeground);
  root.style.setProperty('--sidebar-primary', t.sidebarPrimary);
  root.style.setProperty('--sidebar-primary-foreground', t.sidebarPrimaryForeground);
  root.style.setProperty('--sidebar-accent', t.sidebarAccent);
  root.style.setProperty('--sidebar-accent-foreground', t.sidebarAccentForeground);
  root.style.setProperty('--sidebar-border', t.sidebarBorder);
  root.style.setProperty('--sidebar-ring', t.sidebarRing);

  // Glow + gradient helpers used across components
  root.style.setProperty('--glow-primary', t.primary);
  root.style.setProperty('--glow-accent', t.accent);
  root.style.setProperty('--gradient-start', t.primary);
  root.style.setProperty('--gradient-mid', t.accent);

  document.body.style.background = t.bodyBg;
  document.documentElement.style.background = t.bodyBg;

  // Update status-bar / browser theme color
  try {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = t.statusBar;
  } catch { /* ignore */ }

  try { localStorage.setItem('uf_theme', theme); } catch { /* ignore */ }
};

export type { ThemeMode };

// Run immediately on import — before React mounts.
try {
  const saved = (localStorage.getItem('uf_theme') as ThemeMode) || 'default';
  applyTheme(saved);
} catch {
  applyTheme('default');
}
