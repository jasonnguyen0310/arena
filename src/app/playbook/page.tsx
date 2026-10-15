import Link from "next/link";
import { db, schema } from "@/db";
import { isNotNull } from "drizzle-orm";
import type { Trade } from "@/db/schema";
import EdgeNav from "../EdgeNav";
import EdgeChecklist from "../EdgeChecklist";

export const dynamic = "force-dynamic";
import {
  SETUP_TYPES,
  EXIT_STRATEGIES,
  SETUP_WORKED,
  MARKET_REGIMES,
} from "@/lib/enums";

type Stats = {
  n: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number; // 0..1
  totalPnl: number;
  totalWins: number;
  totalLosses: number;
  profitFactor: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
};

/** planned_size is stored two ways: old trades = contract count, newer = dollar cost.
 *  Detect by threshold and normalize to dollar cost. */
function tradeCostDollars(t: Trade): number {
  const entry = t.actual_entry ?? t.planned_entry;
  if (t.planned_size < 100 && entry != null && entry > 0) {
    return t.planned_size * entry * 100;
  }
  return t.planned_size;
}

function statsFor(trades: Trade[]): Stats {
  let wins = 0;
  let losses = 0;
  let scratches = 0;
  let totalPnl = 0;
  let totalWins = 0;
  let totalLosses = 0;
  const winPcts: number[] = [];
  const lossPcts: number[] = [];

  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    const cost = tradeCostDollars(t);
    let pctRet = cost > 0 ? (pnl / cost) * 100 : NaN;
    // Sanity clamps: long option can't lose more than 100%; cap huge wins to filter
    // out data-entry issues where planned_size was clearly wrong.
    if (isFinite(pctRet)) {
      if (pctRet < -100) pctRet = -100;
      if (pctRet > 1000) pctRet = 1000; // cap outliers at 1000%
    }

    if (t.outcome === "win" || (t.outcome == null && pnl > 0)) {
      wins++;
      totalWins += pnl;
      if (isFinite(pctRet)) winPcts.push(pctRet);
    } else if (t.outcome === "loss" || (t.outcome == null && pnl < 0)) {
      losses++;
      totalLosses += pnl;
      if (isFinite(pctRet)) lossPcts.push(pctRet);
    } else {
      scratches++;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : 0;
  const profitFactor =
    totalLosses < 0 ? Math.abs(totalWins / totalLosses) : totalWins > 0 ? Infinity : null;
  const avgWinPct = winPcts.length ? winPcts.reduce((s, x) => s + x, 0) / winPcts.length : null;
  const avgLossPct = lossPcts.length ? lossPcts.reduce((s, x) => s + x, 0) / lossPcts.length : null;

  return {
    n: trades.length,
    wins,
    losses,
    scratches,
    winRate,
    totalPnl,
    totalWins,
    totalLosses,
    profitFactor,
    avgWinPct,
    avgLossPct,
  };
}

function fmtPct(n: number | null, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}
function fmtPf(n: number | null): string {
  if (n == null) return "—";
  if (!isFinite(n)) return "all wins";
  return n.toFixed(2);
}
function fmtMoney(n: number): string {
  const s = n >= 0 ? "+" : "-";
  return `${s}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function pnlColor(n: number): string {
  if (n > 0) return "var(--color-win)";
  if (n < 0) return "var(--color-loss)";
  return "var(--color-muted)";
}

/** Standard breakdown table: group by a categorical field. */
function BreakdownTable({
  title,
  rows,
  emptyNote,
}: {
  title: string;
  rows: { label: string; stats: Stats; sub?: string }[];
  emptyNote?: string;
}) {
  const filled = rows.filter((r) => r.stats.n > 0);
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
        {title}
      </div>
      {filled.length === 0 ? (
        <div className="p-6 text-sm text-muted">{emptyNote ?? "No tagged trades yet in this dimension."}</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Trades</th>
              <th className="px-4 py-2 text-right">Win rate</th>
              <th className="px-4 py-2 text-right">PF</th>
              <th className="px-4 py-2 text-right">Avg win</th>
              <th className="px-4 py-2 text-right">Avg loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filled
              .sort((a, b) => {
                const aUnt = a.label.startsWith("—");
                const bUnt = b.label.startsWith("—");
                if (aUnt !== bUnt) return aUnt ? 1 : -1; // untagged always last
                // Composite sort: profit factor if defined, else expected-value-per-trade fallback
                function score(s: Stats): number {
                  if (s.profitFactor != null) {
                    if (!isFinite(s.profitFactor)) return Number.MAX_SAFE_INTEGER; // all-wins → top
                    return s.profitFactor + 100; // shift so PF beats EV fallback
                  }
                  // No decided trades — use avg-of-wins minus abs(avg-of-losses)
                  const w = s.avgWinPct ?? 0;
                  const l = s.avgLossPct ?? 0;
                  return (w + l) / 100; // small scaled fallback, keeps sane ordering
                }
                return score(b.stats) - score(a.stats);
              })
              .map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.label}</div>
                    {r.sub && <div className="text-[0.68rem] text-dim">{r.sub}</div>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {r.stats.n}
                    <span className="ml-1 text-[0.65rem] text-dim">
                      ({r.stats.wins}W/{r.stats.losses}L{r.stats.scratches > 0 ? `/${r.stats.scratches}S` : ""})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {r.stats.wins + r.stats.losses > 0
                      ? `${(r.stats.winRate * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums" style={{ color: "var(--color-gold, #a58c56)" }}>
                    {fmtPf(r.stats.profitFactor)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums" style={{ color: "var(--color-win)" }}>
                    {fmtPct(r.stats.avgWinPct)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums" style={{ color: "var(--color-loss)" }}>
                    {fmtPct(r.stats.avgLossPct)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function PlaybookPage() {
  const all = await db.query.trades.findMany({
    where: isNotNull(schema.trades.closed_at),
  });

  const overall = statsFor(all);

  // Setup type breakdown
  const setupRows: { label: string; stats: Stats; sub?: string }[] = SETUP_TYPES.map((s) => ({
    label: s.label as string,
    stats: statsFor(all.filter((t) => t.setup_type === s.value)),
  }));
  setupRows.push({
    label: "— untagged —",
    stats: statsFor(all.filter((t) => t.setup_type == null)),
  });

  // Criteria: for each criterion, split "hit" vs "not hit"
  const CRITERIA: { key: keyof Trade; label: string }[] = [
    { key: "criteria_coiling", label: "Coiling / consolidating" },
    { key: "criteria_resistance", label: "Resistance at key level" },
    { key: "criteria_support", label: "Support at key level" },
    { key: "criteria_hh_hl", label: "Higher highs & lows" },
    { key: "criteria_rel_strength", label: "Relative strength" },
    { key: "criteria_news", label: "News / catalyst" },
  ];
  const criteriaRows = CRITERIA.map((c) => ({
    label: c.label,
    stats: statsFor(all.filter((t) => (t[c.key] as number | null) === 1)),
    sub: "when this criterion was checked",
  }));

  // Criteria score: 0..6 matches
  const scoreRows: { label: string; stats: Stats }[] = [];
  for (let n = 0; n <= 6; n++) {
    const trades = all.filter((t) => {
      const score =
        (t.criteria_coiling ?? 0) +
        (t.criteria_resistance ?? 0) +
        (t.criteria_support ?? 0) +
        (t.criteria_hh_hl ?? 0) +
        (t.criteria_rel_strength ?? 0) +
        (t.criteria_news ?? 0);
      return score === n;
    });
    scoreRows.push({ label: `${n}/6 criteria hit`, stats: statsFor(trades) });
  }

  // Market regime
  const regimeRows: { label: string; stats: Stats; sub?: string }[] = MARKET_REGIMES.map((r) => ({
    label: r.label as string,
    stats: statsFor(all.filter((t) => t.market_regime === r.value)),
  }));
  regimeRows.push({
    label: "— untagged —",
    stats: statsFor(all.filter((t) => t.market_regime == null)),
  });

  // Exit strategy
  const exitRows: { label: string; stats: Stats; sub?: string }[] = EXIT_STRATEGIES.map((e) => ({
    label: e.label as string,
    stats: statsFor(all.filter((t) => t.exit_strategy === e.value)),
  }));

  // Setup worked
  const workedRows: { label: string; stats: Stats; sub?: string }[] = SETUP_WORKED.map((w) => ({
    label: w.label as string,
    stats: statsFor(all.filter((t) => t.setup_worked === w.value)),
  }));

  // Watchlist yes/no/untagged (null is NOT the same as "reactive")
  const watchlistRows: { label: string; stats: Stats; sub?: string }[] = [
    { label: "On my watchlist (pre-planned)", stats: statsFor(all.filter((t) => t.on_watchlist === 1)) },
    { label: "Reactive (not on watchlist)", stats: statsFor(all.filter((t) => t.on_watchlist === 0)) },
    { label: "— untagged —", stats: statsFor(all.filter((t) => t.on_watchlist == null)) },
  ];

  // By position size — normalize planned_size to dollars, bucket by cost basis.
  const SIZE_BUCKETS: { label: string; test: (c: number) => boolean }[] = [
    { label: "<$1,000", test: (c) => c < 1000 },
    { label: "$1,000 – $2,500", test: (c) => c >= 1000 && c < 2500 },
    { label: "$2,500 – $5,000", test: (c) => c >= 2500 && c < 5000 },
    { label: "$5,000 – $10,000", test: (c) => c >= 5000 && c < 10000 },
    { label: "$10,000+", test: (c) => c >= 10000 },
  ];
  const sizeRows: { label: string; stats: Stats; sub?: string }[] = SIZE_BUCKETS.map((b) => ({
    label: b.label,
    stats: statsFor(all.filter((t) => b.test(tradeCostDollars(t)))),
  }));

  // By ticker — group every closed trade by ticker. Only show tickers with N >= 2.
  const tickerMap = new Map<string, Trade[]>();
  for (const t of all) {
    const arr = tickerMap.get(t.ticker) ?? [];
    arr.push(t);
    tickerMap.set(t.ticker, arr);
  }
  const MIN_TICKER_TRADES = 2;
  const tickerRows: { label: string; stats: Stats; sub?: string }[] = [];
  for (const [ticker, trades] of tickerMap.entries()) {
    if (trades.length < MIN_TICKER_TRADES) continue;
    tickerRows.push({ label: `$${ticker}`, stats: statsFor(trades) });
  }
  // Optionally include a single-trade row bucket
  const singleTradeTickers = [...tickerMap.entries()].filter(([, arr]) => arr.length < MIN_TICKER_TRADES);
  if (singleTradeTickers.length > 0) {
    tickerRows.push({
      label: `— ${singleTradeTickers.length} single-trade names —`,
      stats: statsFor(singleTradeTickers.flatMap(([, arr]) => arr)),
      sub: singleTradeTickers.map(([t]) => `$${t}`).slice(0, 20).join(", ") + (singleTradeTickers.length > 20 ? ` +${singleTradeTickers.length - 20} more` : ""),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <EdgeNav />
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Playbook
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            What actually works for you
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every closed trade sliced by setup, criteria, market regime, and exit. The signal you couldn&apos;t see one trade at a time.
          </p>
        </div>
        <Link href="/trades" className="btn btn-ghost">Journal →</Link>
      </div>

      {/* The edge — pillars sit above the data so the criteria frame the stats */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
              The Edge
            </div>
            <blockquote
              className="mt-1 text-sm italic leading-snug text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Momentum on sector leaders with a clear fundamental story I understand, entering at defined key levels once price action confirms.
            </blockquote>
          </div>
          <Link
            href="/edge"
            className="text-[0.68rem] uppercase tracking-wider text-muted hover:text-text"
          >
            Full checklist →
          </Link>
        </div>
        <EdgeChecklist compact />
      </section>

      {/* Overall summary */}
      <section className="grid gap-4 md:grid-cols-5">
        <div className="card p-5">
          <div className="text-xs font-medium text-muted">Closed trades</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{overall.n}</div>
          <div className="mt-1 text-[0.68rem] text-dim">{overall.wins}W · {overall.losses}L · {overall.scratches}S</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-muted">Win rate</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-gold, #a58c56)" }}>
            {overall.wins + overall.losses > 0 ? `${(overall.winRate * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-muted">Profit factor</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-gold, #a58c56)" }}>
            {fmtPf(overall.profitFactor)}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-muted">Avg win</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-win)" }}>
            {fmtPct(overall.avgWinPct)}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-muted">Avg loss</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-loss)" }}>
            {fmtPct(overall.avgLossPct)}
          </div>
        </div>
      </section>

      {/* ── Verdict / Playbook Signal ─────────────────── */}
      {(() => {
        // Best-of table: for a given dimension, find the entry with the highest
        // profit factor (with at least MIN trades). Fall back to highest win rate.
        const MIN_TRADES = 3;
        function best(rows: { label: string; stats: Stats }[]) {
          const eligible = rows.filter(
            (r) => !r.label.startsWith("—") && r.stats.n >= MIN_TRADES && r.stats.profitFactor != null && isFinite(r.stats.profitFactor as number),
          );
          if (eligible.length === 0) return null;
          return eligible.reduce((best, r) =>
            (r.stats.profitFactor as number) > (best.stats.profitFactor as number) ? r : best,
          );
        }
        function worst(rows: { label: string; stats: Stats }[]) {
          const eligible = rows.filter(
            (r) => !r.label.startsWith("—") && r.stats.n >= MIN_TRADES && r.stats.profitFactor != null && isFinite(r.stats.profitFactor as number),
          );
          if (eligible.length === 0) return null;
          return eligible.reduce((worst, r) =>
            (r.stats.profitFactor as number) < (worst.stats.profitFactor as number) ? r : worst,
          );
        }
        const bestSetup = best(setupRows);
        const worstSetup = worst(setupRows);
        const bestExit = best(exitRows);
        const worstExit = worst(exitRows);
        const bestRegime = best(regimeRows);
        const bestCriterion = best(criteriaRows);
        const bestScore = best(scoreRows);
        const bestTicker = best(tickerRows);

        return (
          <section
            className="card p-6"
            style={{
              background: "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
              border: "1px solid rgba(147,197,253,0.32)",
              boxShadow: "0 0 42px -14px rgba(147,197,253,0.35)",
            }}
          >
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
              Playbook signal · what to double down on
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <div className="text-xs text-muted">Your best setup</div>
                {bestSetup ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">{bestSetup.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestSetup.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestSetup.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestSetup.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Not enough tagged trades yet (need ≥ 3 per setup).</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Your best exit</div>
                {bestExit ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">{bestExit.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestExit.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestExit.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestExit.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Not enough tagged exits yet.</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Best market regime</div>
                {bestRegime ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">{bestRegime.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestRegime.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestRegime.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestRegime.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Not enough regime-tagged trades yet.</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Most predictive criterion</div>
                {bestCriterion ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">{bestCriterion.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestCriterion.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestCriterion.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestCriterion.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Not enough criteria-tagged trades yet.</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Your best ticker</div>
                {bestTicker ? (
                  <>
                    <div className="mt-1 text-lg font-semibold font-mono">{bestTicker.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestTicker.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestTicker.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestTicker.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Need at least one ticker with ≥3 trades.</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Best criteria score</div>
                {bestScore ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">{bestScore.label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-muted">
                      <span style={{ color: "var(--color-win)" }}>{(bestScore.stats.winRate * 100).toFixed(0)}%</span> win rate ·{" "}
                      <span style={{ color: "var(--color-gold, #a58c56)" }}>PF {fmtPf(bestScore.stats.profitFactor)}</span>
                      <span className="text-dim"> · {bestScore.stats.n} trades</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-dim">Need more scored trades.</div>
                )}
              </div>
            </div>

            {(worstSetup || worstExit) && (
              <div className="mt-6 border-t border-border/40 pt-4">
                <div className="text-xs text-muted">Consider cutting</div>
                <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
                  {worstSetup && worstSetup !== bestSetup && (
                    <div className="rounded-lg border border-loss/30 bg-loss/5 px-3 py-2">
                      <span className="font-medium">{worstSetup.label}</span>
                      <span className="ml-2 font-mono tabular-nums text-xs text-muted">
                        {(worstSetup.stats.winRate * 100).toFixed(0)}% win · PF {fmtPf(worstSetup.stats.profitFactor)} · {worstSetup.stats.n} trades
                      </span>
                    </div>
                  )}
                  {worstExit && worstExit !== bestExit && (
                    <div className="rounded-lg border border-loss/30 bg-loss/5 px-3 py-2">
                      <span className="font-medium">{worstExit.label} exits</span>
                      <span className="ml-2 font-mono tabular-nums text-xs text-muted">
                        {(worstExit.stats.winRate * 100).toFixed(0)}% win · PF {fmtPf(worstExit.stats.profitFactor)} · {worstExit.stats.n} trades
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="mt-4 text-[0.68rem] text-dim">
              &quot;Best&quot; = highest profit factor with at least 3 trades in the category. Numbers sharpen the more you tag.
            </p>
          </section>
        );
      })()}

      <BreakdownTable title="By setup type" rows={setupRows} />

      <BreakdownTable
        title="By criteria (each one, when checked)"
        rows={criteriaRows}
      />

      <BreakdownTable
        title="By criteria score (how many criteria hit)"
        rows={scoreRows}
      />

      <BreakdownTable title="By market regime (SPX / QQQ)" rows={regimeRows} />

      <BreakdownTable title="By exit strategy" rows={exitRows} />

      <BreakdownTable title="Did the setup work?" rows={workedRows} />

      <BreakdownTable title="Watchlist vs reactive" rows={watchlistRows} />

      <BreakdownTable
        title="By position size (cost basis)"
        rows={sizeRows}
      />

      <BreakdownTable
        title="By ticker (2+ trades)"
        rows={tickerRows}
        emptyNote="No tickers with 2+ trades yet."
      />

      <p className="text-center text-[0.68rem] text-dim">
        Return % here = P&L / planned size. Rough but comparable across trades. Values shown per group only if at least one trade is tagged.
      </p>
    </div>
  );
}
