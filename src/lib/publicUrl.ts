// Always return a publicly shareable origin for Universflow links.
// `window.location.origin` is `http://localhost`, `capacitor://localhost`,
// `file://`, or a preview subdomain in many runtime contexts (dev, Median
// webview, iOS Capacitor, in-app browser) — none of which work when a
// user pastes the link elsewhere. Use the canonical production domain
// for any link a human will share/paste.

export const PUBLIC_ORIGIN = 'https://universflow.in';

/**
 * Returns the canonical public origin (no trailing slash).
 * Use this for ANY URL that will be copied, shared, or opened by other people.
 */
export function publicOrigin(): string {
  return PUBLIC_ORIGIN;
}

/**
 * Build a shareable absolute URL on the public domain.
 * @param path Path starting with "/" (e.g. "/p/abc123").
 */
export function publicUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${PUBLIC_ORIGIN}${p}`;
}
