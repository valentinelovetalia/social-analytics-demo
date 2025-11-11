import express, { Request, Response } from "express";
import "dotenv/config";

type Platform = "Instagram" | "TikTok" | "YouTube" | "X" | "Facebook" | "LinkedIn";

export type MetricPoint = {
  ts: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
};

export type Series = Record<Platform, Record<string, MetricPoint[]>>;

const app = express();

/**
 * GET /api/metrics
 * Example:
 *   /api/metrics?platforms=Instagram,TikTok&accountHandles=club.lore&start=...&end=...
 */
app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    const platforms = String(req.query.platforms || "")
      .split(",").map(s => s.trim()).filter(Boolean) as Platform[];
    const handlesCsv = String(req.query.accountHandles || "").trim();
    const accountHandles = handlesCsv ? handlesCsv.split(",").map(s => s.trim()).filter(Boolean) : [];
    const accountIds = String(req.query.accountIds || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    const start = Number(req.query.start);
    const end = Number(req.query.end);

    if (!platforms.length) throw new Error("platforms required (e.g. Instagram,TikTok)");
    if (!(accountHandles.length || accountIds.length)) throw new Error("accountHandles or accountIds required");
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("start/end (ms) required");

    // If no tokens set, we’ll return mock data so UI still works
    const useMock = !process.env.META_ACCESS_TOKEN || !process.env.META_IG_BUSINESS_ID;

    const targets = accountHandles.length ? accountHandles : accountIds;
    const out: Partial<Series> = {};

    for (const p of platforms) {
      (out as any)[p] = {};
      for (const t of targets) {
        const points = useMock ? generateMockSeries(start, end)
          : await loadPlatformSeriesByHandle(p as Platform, t, start, end);
        (out as any)[p][t] = points;
      }
    }

    res.json(out);
  } catch (e: any) {
    res.status(400).send(String(e?.message || e));
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`[api] ready on :${PORT}`));

// --------- Loaders (real calls optional; mocks keep UI alive) ---------
async function loadPlatformSeriesByHandle(
  platform: Platform, handle: string, start: number, end: number
): Promise<MetricPoint[]> {
  switch (platform) {
    case "Instagram": return instagramSeriesByHandle(handle, start, end);
    case "TikTok": return tiktokSeriesByHandle(handle, start, end);
    default: return [];
  }
}

// Instagram via Meta Graph API (Business Discovery). If missing tokens → mock.
async function instagramSeriesByHandle(handle: string, start: number, end: number): Promise<MetricPoint[]> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const igBusinessId = process.env.META_IG_BUSINESS_ID;
  if (!accessToken || !igBusinessId) return generateMockSeries(start, end);

  const fields = encodeURIComponent(
    `business_discovery.username(${handle}){id,followers_count,media{timestamp,like_count,comments_count}}`
  );
  const url = `https://graph.facebook.com/v20.0/${igBusinessId}?fields=${fields}&access_token=${accessToken}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn("[meta] discovery failed:", await resp.text());
    return generateMockSeries(start, end);
  }
  const data: any = await resp.json();
  const media: any[] = data?.business_discovery?.media?.data || [];
  const posts = media.map(m => ({
    timestamp: m.timestamp as string,
    likes: Number(m.like_count || 0),
    comments: Number(m.comments_count || 0),
    shares: 0,
    views: 0,
    follows: 0,
  }));
  return bucketize(posts, start, end);
}

// TikTok placeholder → returns mock unless you add TIKTOK_ACCESS_TOKEN + calls
async function tiktokSeriesByHandle(handle: string, start: number, end: number): Promise<MetricPoint[]> {
  if (!process.env.TIKTOK_ACCESS_TOKEN) return generateMockSeries(start, end);
  // TODO: implement user lookup + insights. For now, mock so UI works.
  return generateMockSeries(start, end);
}

// --------- Helpers ---------
function bucketize(items: Array<{ timestamp: string; likes: number; comments: number; shares: number; views: number; follows: number; }>,
  start: number, end: number): MetricPoint[] {
  const hour = 60 * 60 * 1000;
  const range = end - start;
  const gran = range <= hour ? 5 * 60 * 1000 : range <= 24 * hour ? 30 * 60 * 1000 : 6 * hour;

  const snap = (ts: number) => start + Math.floor((ts - start) / gran) * gran;
  const buckets = new Map<number, MetricPoint>();

  for (const it of items) {
    const ts = Date.parse(it.timestamp);
    if (!Number.isFinite(ts) || ts < start || ts > end) continue;
    const key = snap(ts);
    if (!buckets.has(key)) buckets.set(key, { ts: key, impressions: 0, likes: 0, comments: 0, shares: 0, follows: 0 });
    const row = buckets.get(key)!;
    row.likes += it.likes || 0;
    row.comments += it.comments || 0;
    row.shares += it.shares || 0;
    row.impressions += it.views || 0;
    row.follows += it.follows || 0;
  }

  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

function generateMockSeries(start: number, end: number): MetricPoint[] {
  const hour = 60 * 60 * 1000;
  const range = end - start;
  const gran = range <= hour ? 5 * 60 * 1000 : range <= 24 * hour ? 30 * 60 * 1000 : 6 * hour;

  const points: MetricPoint[] = [];
  const steps = Math.max(2, Math.floor(range / gran));
  for (let k = 0; k <= steps; k++) {
    const ts = start + k * gran;
    const h = new Date(ts).getUTCHours();
    const diurnal = 0.6 + 0.8 * Math.sin(((h + 2) / 24) * Math.PI * 2) ** 2;
    const base = 1.2;
    const noise = 0.7 + (k % 7) / 10;
    const impressions = Math.max(0, Math.round(300 * base * diurnal * noise));
    points.push({
      ts,
      impressions,
      likes: Math.round(impressions * 0.08),
      comments: Math.round(impressions * 0.015),
      shares: Math.round(impressions * 0.01),
      follows: Math.round(impressions * 0.005),
    });
  }
  return points;
}
