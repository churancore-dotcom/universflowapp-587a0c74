// Piped-based trending feed with country detection, SWR caching, and stream resolution.
// No API keys required. Falls back across multiple public Piped instances.

import { getGeo } from '@/lib/geoLocation';

export interface PipedTrack {
  id: string;          // videoId (or url-derived id)
  videoId: string;
  title: string;
  artist: string;      // uploaderName
  cover_url?: string;  // best thumbnail
  cover_url_low?: string; // small thumbnail for cards (bandwidth friendly)
  duration?: number;
  views?: number;
  rank: number;        // 1-based position in trending
}

export interface CountryInfo {
  cc: string;       // ISO-2
  name: string;     // human-readable
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.nosebs.ru',
];

// Piped /trending only supports certain regions; if user's country is unsupported, fall back to US.
const SUPPORTED_REGIONS = new Set([
  'DZ','AR','AU','AT','AZ','BH','BD','BY','BE','BO','BA','BR','BG','KH','CA','CL','CO','CR','HR','CY','CZ','DK','DO','EC','EG','SV','EE','FI','FR','GE','DE','GH','GR','GT','HN','HK','HU','IS','IN','ID','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KR','KW','LV','LB','LY','LI','LT','LU','MK','MY','MT','MX','ME','MA','NP','NL','NZ','NI','NG','NO','OM','PK','PA','PG','PY','PE','PH','PL','PT','PR','QA','RO','RU','SA','SN','RS','SG','SK','SI','ZA','ES','LK','SE','CH','TW','TZ','TH','TN','TR','UG','UA','AE','GB','US','UY','VE','VN','YE','ZW',
]);

const TRENDING_LS_PREFIX = 'uf_piped_trending_v1::';
const STREAM_LS_KEY = 'uf_piped_streams_v1';
const TRENDING_TTL = 30 * 60 * 1000;     // 30 min hard expiry; we still SWR before that
const STREAM_TTL = 4 * 60 * 60 * 1000;   // 4 h

// ── Country detection (ip-api primary, ipapi.co fallback via geoLocation) ────
let cachedCountry: CountryInfo | null = null;
const COUNTRY_LS = 'uf_country_v1';

const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'USA', GB: 'UK', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', BR: 'Brazil',
  MX: 'Mexico', JP: 'Japan', KR: 'Korea', SG: 'Singapore', AE: 'UAE',
  SA: 'Saudi Arabia', PK: 'Pakistan', BD: 'Bangladesh', RU: 'Russia',
  ID: 'Indonesia', PH: 'Philippines', TR: 'Turkey', NL: 'Netherlands',
  SE: 'Sweden', NO: 'Norway', PL: 'Poland', AR: 'Argentina', CO: 'Colombia',
};

export function countryDisplayName(cc: string, fallback?: string): string {
  if (!cc) return fallback || 'Worldwide';
  return COUNTRY_NAMES[cc.toUpperCase()] || fallback || cc.toUpperCase();
}

export async function detectCountry(): Promise<CountryInfo> {
  if (cachedCountry) return cachedCountry;
  try {
    const raw = localStorage.getItem(COUNTRY_LS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000 && parsed?.data?.cc) {
        cachedCountry = parsed.data;
        return cachedCountry!;
      }
    }
  } catch {/*ignore*/}

  // 1) ip-api (free, no key)
  try {
    const r = await fetch('https://demo.ip-api.com/json/?fields=countryCode,country', { signal: AbortSignal.timeout(3500) });
    if (r.ok) {
      const j: any = await r.json();
      const cc = String(j.countryCode || '').toUpperCase().slice(0, 2);
      if (cc) {
        const info = { cc, name: countryDisplayName(cc, j.country) };
        cachedCountry = info;
        try { localStorage.setItem(COUNTRY_LS, JSON.stringify({ ts: Date.now(), data: info })); } catch {/*q*/}
        return info;
      }
    }
  } catch {/*next*/}

  // 2) ipapi.co fallback (already used elsewhere in app)
  const g = await getGeo();
  const info: CountryInfo = {
    cc: g?.country_code || 'US',
    name: countryDisplayName(g?.country_code || 'US', g?.country_name),
  };
  cachedCountry = info;
  try { localStorage.setItem(COUNTRY_LS, JSON.stringify({ ts: Date.now(), data: info })); } catch {/*q*/}
  return info;
}

// ── Trending fetch ───────────────────────────────────────────────────────────
function pickThumb(thumbnails: any, fallback?: string): { hi?: string; lo?: string } {
  // Piped returns either a string (best thumbnail) or array of variants.
  if (typeof thumbnails === 'string') return { hi: thumbnails, lo: thumbnails };
  if (Array.isArray(thumbnails) && thumbnails.length) {
    const sorted = [...thumbnails].sort((a, b) => (b?.width || 0) - (a?.width || 0));
    return { hi: sorted[0]?.url, lo: sorted[sorted.length - 1]?.url };
  }
  return { hi: fallback, lo: fallback };
}

function isMusicLike(item: any): boolean {
  // Piped trending items don't always carry category. Use heuristics.
  const cat = (item?.category || '').toString().toLowerCase();
  if (cat) return cat.includes('music');
  const t = (item?.title || '').toLowerCase();
  const u = (item?.uploaderName || '').toLowerCase();
  if (/\b(official video|official audio|music video|lyrics|song|mv|album|remix|cover)\b/.test(t)) return true;
  if (/\b(vevo|records|music|topic)\b/.test(u)) return true;
  // Duration filter: trending music tracks are typically < 10 min
  const dur = Number(item?.duration || 0);
  return dur > 60 && dur < 600;
}

function normalizeItems(items: any[]): PipedTrack[] {
  const out: PipedTrack[] = [];
  let rank = 1;
  for (const it of items || []) {
    if (!it) continue;
    const url: string = it.url || '';
    const videoId = (url.match(/[?&]v=([^&]+)/)?.[1]) || it.id || '';
    if (!videoId) continue;
    if (!isMusicLike(it)) continue;
    const thumbs = pickThumb(it.thumbnail || it.thumbnails, it.thumbnailUrl);
    out.push({
      id: videoId,
      videoId,
      title: String(it.title || '').replace(/\s*\(Official.*?\)\s*/gi, '').trim(),
      artist: String(it.uploaderName || it.uploader || 'Unknown').replace(/\s*-\s*Topic\s*$/i, '').trim(),
      cover_url: thumbs.hi,
      cover_url_low: thumbs.lo,
      duration: Number(it.duration) || undefined,
      views: Number(it.views) || undefined,
      rank: rank++,
    });
    if (out.length >= 30) break;
  }
  return out;
}

async function fetchFromInstance(instance: string, region: string, signal: AbortSignal): Promise<PipedTrack[]> {
  const r = await fetch(`${instance}/trending?region=${encodeURIComponent(region)}`, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return normalizeItems(Array.isArray(j) ? j : j?.items || []);
}

function readCachedTrending(region: string): { tracks: PipedTrack[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(TRENDING_LS_PREFIX + region);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.ts && Array.isArray(parsed?.tracks)) return parsed;
  } catch {/*ignore*/}
  return null;
}

function writeCachedTrending(region: string, tracks: PipedTrack[]) {
  try {
    localStorage.setItem(TRENDING_LS_PREFIX + region, JSON.stringify({ ts: Date.now(), tracks }));
  } catch {/*quota*/}
}

/**
 * Fetch trending music for a country with multi-instance race.
 * Stale-while-revalidate: returns cached value via onCached, fresh via onFresh.
 */
export async function getTrendingForCountry(
  cc: string,
  opts?: { onCached?: (tracks: PipedTrack[]) => void; force?: boolean }
): Promise<PipedTrack[]> {
  const region = SUPPORTED_REGIONS.has(cc?.toUpperCase()) ? cc.toUpperCase() : 'US';
  const cached = readCachedTrending(region);
  if (cached && !opts?.force) {
    opts?.onCached?.(cached.tracks);
    // If cache is fresh (under 5 min), skip network
    if (Date.now() - cached.ts < 5 * 60 * 1000) return cached.tracks;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    // Race instances; first non-empty wins
    const tasks = PIPED_INSTANCES.map((inst) =>
      fetchFromInstance(inst, region, ctrl.signal).then((t) => {
        if (!t.length) throw new Error('empty');
        return t;
      })
    );
    const fresh = await Promise.any(tasks);
    clearTimeout(timer);
    writeCachedTrending(region, fresh);
    return fresh;
  } catch (e) {
    clearTimeout(timer);
    if (cached) return cached.tracks;
    throw e;
  }
}

// ── Stream resolution (Piped /streams/{videoId}) ─────────────────────────────
interface StreamCacheEntry { url: string; expiresAt: number; }
function readStreamCache(): Record<string, StreamCacheEntry> {
  try { return JSON.parse(localStorage.getItem(STREAM_LS_KEY) || '{}'); } catch { return {}; }
}
function writeStreamCache(map: Record<string, StreamCacheEntry>) {
  try {
    // Trim to 100 most recent
    const entries = Object.entries(map).filter(([, v]) => v.expiresAt > Date.now()).slice(-100);
    localStorage.setItem(STREAM_LS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {/*quota*/}
}

const inFlight = new Map<string, Promise<string | null>>();

export async function resolvePipedStream(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  const map = readStreamCache();
  const hit = map[videoId];
  if (hit && hit.expiresAt > Date.now()) return hit.url;

  if (inFlight.has(videoId)) return inFlight.get(videoId)!;

  const task = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const tasks = PIPED_INSTANCES.map(async (inst) => {
        const r = await fetch(`${inst}/streams/${videoId}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j: any = await r.json();
        const audio = (j.audioStreams || []).filter((s: any) => s?.url);
        if (!audio.length) throw new Error('no-audio');
        // Pick best audio: prefer highest bitrate m4a/opus
        audio.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        return audio[0].url as string;
      });
      const url = await Promise.any(tasks);
      clearTimeout(timer);
      const fresh = readStreamCache();
      fresh[videoId] = { url, expiresAt: Date.now() + STREAM_TTL };
      writeStreamCache(fresh);
      return url;
    } catch {
      clearTimeout(timer);
      return null;
    } finally {
      inFlight.delete(videoId);
    }
  })();
  inFlight.set(videoId, task);
  return task;
}

export function prefetchPipedStream(videoId: string) {
  resolvePipedStream(videoId).catch(() => {/*silent*/});
}
