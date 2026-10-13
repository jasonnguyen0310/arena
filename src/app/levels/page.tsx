import Link from "next/link";
import { db, schema } from "@/db";
import { isNotNull, and } from "drizzle-orm";
import type { Trade, KeyLevel } from "@/db/schema";
import { KEY_LEVEL_LABELS } from "@/lib/enums";
import { addKeyLevel, deleteKeyLevel } from "./actions";
import EdgeNav from "../EdgeNav";

export const dynamic = "force-dynamic";

function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
function pnlColor(n: number): string {
  if (n > 0) return "var(--color-win)";
  if (n < 0) return "var(--color-loss)";
  return "var(--color-muted)";
}

/** planned_size < 100 = raw contract count; >= 100 = dollar cost basis. */
function tradeCostDollars(t: Trade): number {
  const entry = t.actual_entry ?? t.planned_entry;
  if (t.planned_size < 100 && entry != null && entry > 0) {
    return t.planned_size * entry * 100;
  }
  return t.planned_size;
}

function clampPct(pct: number | null): number | null {
  if (pct == null || !isFinite(pct)) return null;
  if (pct < -100) return -100;
  if (pct > 1000) return 1000;
  return pct;
}

type LevelStats = {
  price: number;
  n: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  avgReturnPct: number;
  totalPnl: number;
  score: number; // composite ranking metric
};

type TickerCard = {
  ticker: string;
  totalTrades: number;
  totalPnl: number;
  levels: LevelStats[];
};

function statsForLevel(price: number, trades: Trade[]): LevelStats {
  let wins = 0;
  let losses = 0;
  let scratches = 0;
  let totalPnl = 0;
  const rets: number[] = [];
  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    if (t.outcome === "win" || (t.outcome == null && pnl > 0)) wins++;
    else if (t.outcome === "loss" || (t.outcome == null && pnl < 0)) losses++;
    else scratches++;
    const cost = tradeCostDollars(t);
    if (cost > 0) {
      const raw = (pnl / cost) * 100;
      const c = clampPct(raw);
      if (c != null) rets.push(c);
    }
  }
  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : 0;
  const avgReturnPct = rets.length ? rets.reduce((s, x) => s + x, 0) / rets.length : 0;
  // Composite score: frequency × expected value. Higher = more actionable.
  // Uses expected value per trade (winRate × avgWin − lossRate × avgLoss simplified via avgReturnPct).
  const score = trades.length * (avgReturnPct / 100 + winRate);
  return {
    price,
    n: trades.length,
    wins,
    losses,
    scratches,
    winRate,
    avgReturnPct,
    totalPnl,
    score,
  };
}

type WatchedLevel = {
  id: number;
  price: number;
  label: string;
  note: string | null;
};

type TickerRow =
  | ({ kind: "traded" } & LevelStats)
  | ({ kind: "watching" } & WatchedLevel);

type TickerCardX = {
  ticker: string;
  totalTrades: number;
  totalPnl: number;
  rows: TickerRow[];
};

function labelColor(label: string): { bg: string; fg: string; border: string } {
  switch (label) {
    case "support":
      return { bg: "rgba(74,222,128,0.10)", fg: "#4ADE80", border: "rgba(74,222,128,0.35)" };
    case "resistance":
      return { bg: "rgba(147,197,253,0.10)", fg: "#93C5FD", border: "rgba(147,197,253,0.35)" };
    case "breakout":
      return { bg: "rgba(250,204,21,0.10)", fg: "#FACC15", border: "rgba(250,204,21,0.35)" };
    case "target":
      return { bg: "rgba(74,222,128,0.14)", fg: "#4ADE80", border: "rgba(74,222,128,0.45)" };
    case "invalidation":
      return { bg: "rgba(248,113,113,0.10)", fg: "#F87171", border: "rgba(248,113,113,0.30)" };
    default:
      return { bg: "rgba(255,255,255,0.05)", fg: "var(--color-muted)", border: "rgba(255,255,255,0.10)" };
  }
}
function labelText(v: string): string {
  return KEY_LEVEL_LABELS.find((l) => l.value === v)?.label ?? v;
}

export default async function LevelsPage() {
  const [withLevels, watched] = await Promise.all([
    db.query.trades.findMany({
      where: and(isNotNull(schema.trades.key_level), isNotNull(schema.trades.closed_at)),
    }),
    db.query.key_levels.findMany(),
  ]);

  // Group traded levels by ticker → price
  const byTicker = new Map<string, Map<number, Trade[]>>();
  for (const t of withLevels) {
    if (t.key_level == null) continue;
    const tickerMap = byTicker.get(t.ticker) ?? new Map<number, Trade[]>();
    const arr = tickerMap.get(t.key_level) ?? [];
    arr.push(t);
    tickerMap.set(t.key_level, arr);
    byTicker.set(t.ticker, tickerMap);
  }

  // Group watched levels by ticker
  const watchedByTicker = new Map<string, WatchedLevel[]>();
  for (const w of watched) {
    const arr = watchedByTicker.get(w.ticker) ?? [];
    arr.push({ id: w.id, price: w.price, label: w.label, note: w.note });
    watchedByTicker.set(w.ticker, arr);
  }

  // Merge: get union of tickers
  const allTickers = new Set<string>([...byTicker.keys(), ...watchedByTicker.keys()]);

  const cards: TickerCardX[] = [];
  for (const ticker of allTickers) {
    const tradedMap = byTicker.get(ticker) ?? new Map<number, Trade[]>();
    const watchedList = watchedByTicker.get(ticker) ?? [];

    const rows: TickerRow[] = [];
    let totalTrades = 0;
    let totalPnl = 0;

    const tradedPrices: number[] = [];
    for (const [price, trades] of tradedMap.entries()) {
      const s = statsForLevel(price, trades);
      rows.push({ kind: "traded", ...s });
      tradedPrices.push(price);
      totalTrades += s.n;
      totalPnl += s.totalPnl;
    }
    // Skip manual entries that duplicate a traded level for the same ticker.
    // Trade-derived levels take priority.
    for (const w of watchedList) {
      const isDup = tradedPrices.some((p) => Math.abs(p - w.price) < 0.005);
      if (isDup) continue;
      rows.push({ kind: "watching", ...w });
    }

    // Sort: traded before watching, then within each by score/price
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "traded" ? -1 : 1;
      if (a.kind === "traded" && b.kind === "traded") {
        if (b.score !== a.score) return b.score - a.score;
        return b.n - a.n;
      }
      return b.price - a.price;
    });

    cards.push({ ticker, totalTrades, totalPnl, rows });
  }
  cards.sort((a, b) => {
    if (b.totalTrades !== a.totalTrades) return b.totalTrades - a.totalTrades;
    return b.totalPnl - a.totalPnl;
  });

  // Top-of-page "hottest levels" — individual (ticker, price) combos with the
  // highest composite score. Requires min 2 trades. Watched-only levels excluded.
  const flat: (LevelStats & { ticker: string })[] = [];
  for (const c of cards) {
    for (const r of c.rows) {
      if (r.kind === "traded" && r.n >= 2) flat.push({ ...r, ticker: c.ticker });
    }
  }
  flat.sort((a, b) => b.score - a.score);
  const topLevels = flat.slice(0, 6);

  const totalUniqueLevels = cards.reduce((s, c) => s + c.rows.length, 0);
  const totalTrades = cards.reduce((s, c) => s + c.totalTrades, 0);
  const totalWatched = cards.reduce(
    (s, c) => s + c.rows.filter((r) => r.kind === "watching").length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <EdgeNav />
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Key Levels
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">The levels that move you</h1>
          <p className="mt-1 text-sm text-muted">
            Derived from the <span className="font-mono">Key level</span> field on your journal
            entries. Ranked by frequency traded, win rate, and average return.
          </p>
        </div>
        <Link href="/trades" className="btn btn-ghost">Journal →</Link>
      </div>

      {/* Quick add — significant levels observed from trading / backtesting */}
      <section className="card p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
          Add a significant level
        </div>
        <p className="mb-3 text-xs text-muted">
          Levels you&apos;ve identified from backtesting or price action — not hypothetical watches.
        </p>
        <form action={addKeyLevel} className="grid grid-cols-1 gap-3 md:grid-cols-[7rem_8rem_9rem_1fr_auto] md:items-end">
          <div>
            <label htmlFor="ticker" className="text-[0.68rem] uppercase tracking-wider text-muted">Ticker</label>
            <input id="ticker" name="ticker" required placeholder="BE" autoComplete="off" className="!py-2" />
          </div>
          <div>
            <label htmlFor="price" className="text-[0.68rem] uppercase tracking-wider text-muted">Price</label>
            <input id="price" name="price" type="number" step="any" required placeholder="283" className="!py-2 font-mono" />
          </div>
          <div>
            <label htmlFor="label" className="text-[0.68rem] uppercase tracking-wider text-muted">Label</label>
            <select id="label" name="label" defaultValue="resistance" className="!py-2">
              {KEY_LEVEL_LABELS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="note" className="text-[0.68rem] uppercase tracking-wider text-muted">Note (optional)</label>
            <input id="note" name="note" placeholder="Held 4x in the last 3 months, tested at open" className="!py-2" />
          </div>
          <button type="submit" className="btn btn-primary !py-2">Add</button>
        </form>
      </section>

      {cards.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          No levels yet. Add a significant level above, or tag <span className="font-mono">Key level</span> when opening a trade.
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <section className="grid grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Tickers</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{cards.length}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Levels tracked</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{totalUniqueLevels}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Marked significant</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "#93C5FD" }}>
                {totalWatched}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Trades tagged</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{totalTrades}</div>
            </div>
          </section>

          {/* Top levels overall */}
          {topLevels.length > 0 && (
            <section
              className="card p-6"
              style={{
                background: "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
                border: "1px solid rgba(147,197,253,0.28)",
                boxShadow: "0 0 42px -14px rgba(147,197,253,0.35)",
              }}
            >
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
                Highest-signal levels
              </div>
              <p className="mt-1 text-xs text-muted">
                Ranked by frequency × (win rate + avg return). Minimum 2 trades to appear.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {topLevels.map((l) => (
                  <div key={`${l.ticker}-${l.price}`} className="rounded-xl border border-border/60 bg-surface/40 p-4">
                    <div className="flex items-baseline justify-between">
                      <div className="font-mono text-lg font-semibold">{l.ticker}</div>
                      <div className="font-mono text-xl font-bold tabular-nums">
                        ${l.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{l.n} trades</span>
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>
                        {l.wins + l.losses > 0 ? `${(l.winRate * 100).toFixed(0)}%` : "—"} win
                      </span>
                      <span style={{ color: pnlColor(l.avgReturnPct) }} className="font-mono tabular-nums">
                        {fmtPct(l.avgReturnPct)} avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Per-ticker cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <section key={c.ticker} className="card overflow-hidden">
                <div className="border-b border-border px-5 py-3 flex items-baseline justify-between">
                  <div className="font-mono text-lg font-semibold">{c.ticker}</div>
                  <div className="text-[0.68rem] text-muted">
                    {c.rows.length} level{c.rows.length === 1 ? "" : "s"} · {c.totalTrades} trade
                    {c.totalTrades === 1 ? "" : "s"}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-2">Level</th>
                      <th className="px-4 py-2 text-right">Trades</th>
                      <th className="px-4 py-2 text-right">Win %</th>
                      <th className="px-4 py-2 text-right">Avg return</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {c.rows.map((r) => {
                      if (r.kind === "traded") {
                        return (
                          <tr key={`t-${r.price}`} className="hover:bg-surface/40">
                            <td className="px-4 py-2 font-mono font-semibold tabular-nums">
                              ${r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums">
                              {r.n}
                              <span className="ml-1 text-[0.65rem] text-dim">
                                ({r.wins}W/{r.losses}L{r.scratches > 0 ? `/${r.scratches}S` : ""})
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums">
                              {r.wins + r.losses > 0 ? `${(r.winRate * 100).toFixed(0)}%` : "—"}
                            </td>
                            <td
                              className="px-4 py-2 text-right font-mono font-semibold tabular-nums"
                              style={{ color: pnlColor(r.avgReturnPct) }}
                            >
                              {fmtPct(r.avgReturnPct)}
                            </td>
                            <td className="px-4 py-2"></td>
                          </tr>
                        );
                      }
                      // Watching row
                      const c2 = labelColor(r.label);
                      return (
                        <tr key={`w-${r.id}`} className="hover:bg-surface/40" style={{ background: "rgba(147,197,253,0.03)" }}>
                          <td className="px-4 py-2 font-mono font-semibold tabular-nums">
                            ${r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider"
                              style={{ background: c2.bg, color: c2.fg, border: `1px solid ${c2.border}` }}
                            >
                              {labelText(r.label)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-[0.65rem] text-dim">key level</td>
                          <td className="px-4 py-2 text-right text-xs text-muted">
                            {r.note || <span className="text-dim">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <form action={deleteKeyLevel.bind(null, r.id)}>
                              <button
                                type="submit"
                                className="text-[0.68rem] text-muted hover:text-loss"
                                aria-label={`Delete key level ${r.price}`}
                              >
                                ✕
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
