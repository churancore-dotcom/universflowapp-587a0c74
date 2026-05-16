// Generates public/sitemap.xml for Universflow's indexable public routes.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://universflow.in";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const entries: SitemapEntry[] = [
  { path: "/", lastmod: "2026-05-16", changefreq: "daily", priority: "1.0" },
  { path: "/home", lastmod: "2026-05-16", changefreq: "daily", priority: "0.95" },
  { path: "/search", lastmod: "2026-05-16", changefreq: "daily", priority: "0.9" },
  { path: "/artists", lastmod: "2026-05-16", changefreq: "weekly", priority: "0.85" },
  { path: "/premium", lastmod: "2026-05-16", changefreq: "monthly", priority: "0.8" },
  { path: "/support", lastmod: "2026-05-16", changefreq: "monthly", priority: "0.65" },
  { path: "/library", lastmod: "2026-05-16", changefreq: "weekly", priority: "0.7" },
  { path: "/auth", lastmod: "2026-05-16", changefreq: "monthly", priority: "0.6" },
  { path: "/playlist/e015b693-1b9a-4014-ac42-2ff290806b1c", lastmod: "2026-05-16", changefreq: "weekly", priority: "0.65" },
  { path: "/playlist/174da7f9-083b-471e-a5ff-a343e744cb1a", lastmod: "2026-05-16", changefreq: "weekly", priority: "0.65" },
];

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function generateSitemap(items: SitemapEntry[]) {
  const seen = new Set<string>();
  const urls = items
    .filter((entry) => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    })
    .map((entry) => [
      "  <url>",
      `    <loc>${escapeXml(`${BASE_URL}${entry.path}`)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      "  </url>",
    ].filter(Boolean).join("\n"));

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

try {
  const outPath = resolve("public/sitemap.xml");
  writeFileSync(outPath, generateSitemap(entries));
  console.log(`[sitemap] OK — wrote ${entries.length} entries to ${outPath}`);
} catch (err) {
  console.error("[sitemap] FAILED to generate public/sitemap.xml");
  console.error("[sitemap] Reason:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
}
