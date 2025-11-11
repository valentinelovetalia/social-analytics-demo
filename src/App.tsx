import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, CartesianGrid } from "recharts";

type Platform = "Instagram" | "TikTok" | "YouTube" | "X" | "Facebook" | "LinkedIn";
type RangeKey = "1h" | "24h" | "7d" | "30d" | "review7d";
type MetricPoint = { ts: number; impressions: number; likes: number; comments: number; shares: number; follows: number; };
type Series = Record<Platform, Record<string, MetricPoint[]>>;

const ALL_PLATFORMS: Platform[] = ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"];
const PRIORITY: Platform[] = ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"];
const fmtNum = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default function App() {
  const [anchorTs, setAnchorTs] = useState<number>(() => Date.now());
  const [range, setRange] = useState<RangeKey>("24h");
  const { start, end } = useMemo(() => {
    const hour = 3600000;
    switch (range) {
      case "1h": return { start: anchorTs - hour, end: anchorTs };
      case "24h": return { start: anchorTs - 24 * hour, end: anchorTs };
      case "7d":
      case "review7d": return { start: anchorTs - 7 * 24 * hour, end: anchorTs };
      case "30d": return { start: anchorTs - 30 * 24 * hour, end: anchorTs };
    }
  }, [range, anchorTs]);

  // API endpoint is RELATIVE so Vite proxy forwards to Express
  const api = "/api/metrics";
  const [handles, setHandles] = useState("club.lore");
  const [platforms, setPlatforms] = useState<Platform[]>(["Instagram", "TikTok"]);

  // accounts UI
  const accountsForUi = useMemo(() => handles.split(",").map(h => h.trim()).filter(Boolean).map(h => ({ id: h, handle: `@${h}`, display: h })), [handles]);
  const [focus, setFocus] = useState(false);
  const [activeId, setActiveId] = useState<string>(() => accountsForUi[0]?.id || "");
  useEffect(() => { if (!accountsForUi.find(a => a.id === activeId)) setActiveId(accountsForUi[0]?.id || ""); }, [accountsForUi, activeId]);
  const activeIds = useMemo(() => (focus ? [activeId] : accountsForUi.map(a => a.id)), [focus, activeId, accountsForUi]);

  // data
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const url = new URL(api, window.location.origin);
        url.searchParams.set("platforms", platforms.join(","));
        url.searchParams.set("accountHandles", handles);
        url.searchParams.set("accountIds", activeIds.join(","));
        url.searchParams.set("start", String(start));
        url.searchParams.set("end", String(end));
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as Series;
        if (mounted) setSeries(data);
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [platforms.join(","), handles, activeIds.join(","), start, end, api]);

  // aggregate
  const metric: keyof MetricPoint = "impressions";
  const agg = useMemo(() => {
    if (!series) return null;
    const timestamps = new Set<number>();
    platforms.forEach(p => activeIds.forEach(id => (series[p]?.[id] || []).forEach(pt => timestamps.add(pt.ts))));
    const xs = Array.from(timestamps).sort((a, b) => a - b);
    const rows = xs.map(ts => {
      const row: any = { ts };
      platforms.forEach(p => {
        row[p] = sum(activeIds.map(id => (series[p]?.[id] || []).find(pt => pt.ts === ts)?.[metric] ?? 0));
      });
      row.total = platforms.reduce((acc, p) => acc + row[p], 0);
      return row;
    });
    const totalsByPlatform = platforms.reduce((acc, p) => ((acc as any)[p] = sum(rows.map(r => r[p] as number)), acc), {} as Record<Platform, number>);
    const overall = sum(rows.map(r => r.total as number));
    return { rows, totalsByPlatform, overall };
  }, [series, platforms, activeIds]);

  const chartRows = useMemo(() => {
    if (!agg) return [];
    const short = (ts: number) => new Date(ts).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
    return agg.rows.map(r => ({
      ts: (r as any).ts,
      label: short((r as any).ts),
      ...platforms.reduce((acc, p) => (((acc as any)[p] = (r as any)[p]), acc), {} as Record<string, number>),
      total: (r as any).total
    }));
  }, [agg, platforms]);

  const mostPopular = useMemo(() => {
    if (!agg) return null;
    const vals = Object.values(agg.totalsByPlatform);
    const max = Math.max(...vals);
    for (const p of PRIORITY) if ((agg.totalsByPlatform as any)[p] === max) return p;
    return null;
  }, [agg]);

  // UI helpers
  const pill: React.CSSProperties = { padding: "8px 12px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer" };
  const pillActive: React.CSSProperties = { ...pill, borderColor: "#000", background: "#000", color: "#fff" };
  const card: React.CSSProperties = { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", color: "#111827" }}>
      <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 20px", zIndex: 10 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Cross-Platform Social Analytics</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Last hour · 24 hours · 7 days · 30 days · Review 7d</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["1h","24h","7d","30d","review7d"] as RangeKey[]).map(k => (
              <button key={k} style={range === k ? pillActive : pill} onClick={() => setRange(k)}>{k === "review7d" ? "Review 7d" : k}</button>
            ))}
            <button style={pill} onClick={() => setAnchorTs(Date.now())}>Sync now</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: 20 }}>
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Platforms</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ALL_PLATFORMS.map(p => {
                  const active = platforms.includes(p);
                  return (
                    <button key={p} style={active ? pillActive : pill}
                      onClick={() => setPlatforms(prev => active ? prev.filter(x => x !== p) : [...prev, p])}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Mode</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button style={!focus ? pillActive : pill} onClick={() => setFocus(false)}>Compare</button>
                <button style={focus ? pillActive : pill} onClick={() => setFocus(true)}>Focus one</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>Accounts (handles)</div>
              <input value={handles} onChange={e => setHandles(e.target.value)} placeholder="club.lore"
                style={{ marginTop: 8, width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db" }} />
              {focus && (
                <select value={activeId} onChange={e => setActiveId(e.target.value)}
                  style={{ marginTop: 8, width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #d1d5db" }}>
                  {accountsForUi.map(a => <option key={a.id} value={a.id}>{a.display} (@{a.id})</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ height: 128, background: "#e5e7eb", borderRadius: 16 }} />
      </div>}
      {err && <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 16, padding: 12, fontSize: 12 }}>{err}</div>
      </div>}

      {!loading && agg && series && (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 40px", display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Total impressions</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date(start).toLocaleString()} → {new Date(end).toLocaleString()}</div>
                </div>
                {mostPopular && (
                  <span style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "4px 10px", borderRadius: 999 }}>
                    Most popular: <b style={{ marginLeft: 4 }}>{mostPopular}</b>
                  </span>
                )}
              </div>
              <div style={{ height: 260, marginTop: 12, willChange: "transform", transform: "translateZ(0)" }}>
                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                  <LineChart data={chartRows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => fmtNum(Number(v))} />
                    <Legend />
                    {platforms.map(p => <Line key={p} type="monotone" dataKey={p} strokeWidth={2} dot={false} isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 16 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Impressions (all selected)</div>
                <div style={{ marginTop: 8, fontSize: 28, fontWeight: 600 }}>{fmtNum(agg.overall)}</div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 16 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Platforms compared</div>
                <div style={{ marginTop: 8, fontSize: 28, fontWeight: 600 }}>{platforms.length}</div>
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Platform comparison</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Which platform wins</div>
            </div>
            <div style={{ height: 300, marginTop: 12, willChange: "transform", transform: "translateZ(0)" }}>
              <ResponsiveContainer width="100%" height="100%" debounce={200}>
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => fmtNum(Number(v))} />
                  <Legend />
                  {platforms.map(p => <Bar key={p} dataKey={p} stackId="a" isAnimationActive={false} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}