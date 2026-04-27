// Tiny global signal to coordinate the in-app lock-screen overlay
// with MiniPlayer / FullscreenPlayer so they don't stack visually.
const EVENT = 'uf:lockscreen-state';

let isOpen = false;

export const setLockscreenOpen = (open: boolean) => {
  if (isOpen === open) return;
  isOpen = open;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { open } }));
};

export const isLockscreenOpen = () => isOpen;

export const subscribeLockscreen = (cb: (open: boolean) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent).detail.open);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
