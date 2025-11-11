import express, { Request, Response } from "express";
import "dotenv/config";

type Platform = "Instagram" | "TikTok" | "YouTube" | "X" | "Facebook" | "LinkedIn";
type MetricPoint = { ts: number; impressions: number; likes: number; comments: number; shares: number; follows: number; };
type Series = Record<Platform, Record<string, MetricPoint[]>>;

const app = express();

/** GET /api/metrics?platforms=Instagram,TikTok&accountHandles=club.lore&start=...&end=... */
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

    if (!platforms.length) throw new Error("platforms required");
    if (!(accountHandles.length || accountIds.length)) throw new Error("accountHandles or accountIds required");
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("start/end (ms) required");

    const targets = accountHandles.length ? accountHandles : accountIds;
    const out: Partial<Series> = {};
    for (const p of platforms) {
      (out as any)[p] = {};
      for (const t of targets) {
        (out as any)[p][t] = generateMockSeries(start, end);
      }
    }
    res.json(out);
  } catch (e: any) {
    res.status(400).send(String(e?.message || e));
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[api] ready on :${PORT}`));

// ---------- Helpers (mock data) ----------
function generateMockSeries(start: number, end: number): MetricPoint[] {
  const hour = 3600000;
  const range = end - start;
  const gran = range <= hour ? 5 * 60 * 1000 : range <= 24 * hour ? 30 * 60 * 1000 : 6 * hour;
  const steps = Math.max(2, Math.floor(range / gran));
  const out: MetricPoint[] = [];
  for (let k = 0; k <= steps; k++) {
    const ts = start + k * gran;
    const h = new Date(ts).getUTCHours();
    const diurnal = 0.6 + 0.8 * Math.sin(((h + 2) / 24) * Math.PI * 2) ** 2;
    const noise = 0.7 + (k % 7) / 10;
    const base = 1.2;
    const impressions = Math.max(0, Math.round(300 * base * diurnal * noise));
    out.push({
      ts,
      impressions,
      likes: Math.round(impressions * 0.08),
      comments: Math.round(impressions * 0.015),
      shares: Math.round(impressions * 0.01),
      follows: Math.round(impressions * 0.005)
    });
  }
  return out;
}