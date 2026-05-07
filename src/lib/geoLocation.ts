// IP geolocation with 24h localStorage cache. Used for "Viral in <Country>".
const KEY = 'uf_geo_v1';
const TTL = 24 * 60 * 60 * 1000;

export interface GeoInfo {
  country_code: string; // ISO-2 e.g. "IN"
  country_name: string;
  city?: string;
}

const COUNTRY_FLAG: Record<string, string> = {
  IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
  DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', BR: '🇧🇷',
  MX: '🇲🇽', JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', SG: '🇸🇬',
  AE: '🇦🇪', SA: '🇸🇦', PK: '🇵🇰', BD: '🇧🇩', RU: '🇷🇺',
  ID: '🇮🇩', PH: '🇵🇭', TR: '🇹🇷', NL: '🇳🇱', SE: '🇸🇪',
  NO: '🇳🇴', PL: '🇵🇱', AR: '🇦🇷', CO: '🇨🇴', CL: '🇨🇱',
};

export function flagFor(cc: string): string {
  return COUNTRY_FLAG[cc?.toUpperCase()] || '🌍';
}

export async function getGeo(): Promise<GeoInfo | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < TTL && parsed.data?.country_code) {
        return parsed.data as GeoInfo;
      }
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j: any = await res.json();
    const data: GeoInfo = {
      country_code: String(j.country_code || j.country || '').toUpperCase().slice(0, 2),
      country_name: String(j.country_name || j.country || ''),
      city: j.city || undefined,
    };
    if (!data.country_code) return null;
    try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
    return data;
  } catch {
    return null;
  }
}
