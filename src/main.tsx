import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import "./index.css";

// Initialize Median detection globals
import "@/lib/median";

// Force clear stale service worker auth caches
if ('caches' in window) {
  caches.open('supabase-cache').then(cache => {
    cache.keys().then(keys => {
      keys.forEach(request => {
        if (request.url.includes('/auth/')) {
          cache.delete(request);
        }
      });
    });
  }).catch(() => {});
}
// WebView compatibility: polyfill for older WebViews
if (typeof window !== 'undefined') {
  // Polyfill for requestAnimationFrame (needed in some old WebViews)
  const win = window as Window & { webkitRequestAnimationFrame?: typeof requestAnimationFrame };
  window.requestAnimationFrame = window.requestAnimationFrame || 
    win.webkitRequestAnimationFrame || 
    ((callback: FrameRequestCallback) => setTimeout(callback, 16));

  // Polyfill for Promise.allSettled if missing
  if (!Promise.allSettled) {
    Promise.allSettled = (promises: Promise<unknown>[]) =>
      Promise.all(
        promises.map((p) =>
          p.then(
            (value) => ({ status: 'fulfilled' as const, value }),
            (reason) => ({ status: 'rejected' as const, reason })
          )
        )
      );
  }
}

// Error boundary for unhandled errors (helps with WebView debugging)
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Prevent white screen by showing fallback
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="position:fixed;inset:0;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;text-align:center;padding:24px;">
        <div style="font-size:48px;margin-bottom:16px;">♪</div>
        <h1 style="font-size:24px;margin-bottom:8px;">Univers Flow</h1>
        <p style="opacity:0.6;font-size:14px;margin-bottom:24px;">Loading...</p>
        <button onclick="location.reload()" style="background:rgba(255,255,255,0.15);border:none;padding:12px 32px;border-radius:999px;color:#fff;font-size:14px;cursor:pointer;">
          Retry
        </button>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error('React render error:', error);
    // Show fallback UI
    rootElement.innerHTML = `
      <div style="position:fixed;inset:0;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;text-align:center;padding:24px;">
        <div style="font-size:48px;margin-bottom:16px;">♪</div>
        <h1 style="font-size:24px;margin-bottom:8px;">Univers Flow</h1>
        <p style="opacity:0.6;font-size:14px;margin-bottom:24px;">Something went wrong</p>
        <button onclick="location.reload()" style="background:rgba(255,255,255,0.15);border:none;padding:12px 32px;border-radius:999px;color:#fff;font-size:14px;cursor:pointer;">
          Retry
        </button>
      </div>
    `;
  }
} else {
  console.error('Root element not found');
}
