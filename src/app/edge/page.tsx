import EdgeNav from "../EdgeNav";
import EdgeChecklist from "../EdgeChecklist";
import { db, schema } from "@/db";
import { isNotNull } from "drizzle-orm";
import type { Trade } from "@/db/schema";

export const dynamic = "force-dynamic";

type TickerStats = {
  ticker: string;
  n: number;
  wins: number;
  losses: number;
  pf: number | null; // null = all wins
  totalPnl: number;
};

function tickerStats(trades: Trade[]): TickerStats | null {
  if (trades.length === 0) return null;
  let wins = 0, losses = 0, grossWins = 0, grossLosses = 0, totalPnl = 0;
  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    if (t.outcome === "win" || (t.outcome == null && pnl > 0)) wins++;
    else if (t.outcome === "loss" || (t.outcome == null && pnl < 0)) losses++;
    if (pnl > 0) grossWins += pnl;
    else if (pnl < 0) grossLosses += -pnl;
  }
  const pf = grossLosses > 0 ? grossWins / grossLosses : null;
  return { ticker: trades[0].ticker, n: trades.length, wins, losses, pf, totalPnl };
}

export default async function EdgePage() {
  const closed = await db.query.trades.findMany({
    where: isNotNull(schema.trades.closed_at),
  });

  const byTicker = new Map<string, Trade[]>();
  for (const t of closed) {
    const arr = byTicker.get(t.ticker) ?? [];
    arr.push(t);
    byTicker.set(t.ticker, arr);
  }

  const MIN_TRADES = 2;
  const topTickers = [...byTicker.values()]
    .map(tickerStats)
    .filter((s): s is TickerStats => s != null && s.n >= MIN_TRADES && s.totalPnl > 0)
    .sort((a, b) => {
      // "all wins" (pf null) sorts to top, then by pf desc, then by n desc
      if (a.pf == null && b.pf == null) return b.n - a.n;
      if (a.pf == null) return -1;
      if (b.pf == null) return 1;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return b.n - a.n;
    })
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EdgeNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            The Edge
          </div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            Six pillars, or no trade
          </h1>
        </div>
        <blockquote
          className="max-w-2xl rounded-xl px-4 py-3 text-sm leading-snug"
          style={{
            background:
              "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
            border: "1px solid rgba(147,197,253,0.28)",
            fontFamily: "var(--font-display)",
          }}
        >
          I trade <em>breakouts</em> on <em>sector leaders</em> with a{" "}
          <em>clear fundamental story I understand</em>, entering at{" "}
          <em>defined key levels</em> once{" "}
          <em>momentum is confirmed by price action</em>.
        </blockquote>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-3">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Sizing &amp; Risk
          </div>
          <div
            className="mt-1 text-sm font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Position tiers &amp; hard limits
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border/60 md:grid-cols-4">
          <div className="px-5 py-4">
            <div
              className="text-[0.6rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#FACC15" }}
            >
              Tier 0 · Lotto
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              $500 – $1k
            </div>
            <div className="mt-1 text-[0.68rem] text-muted">0DTE / high-risk lotteries</div>
          </div>
          <div className="px-5 py-4">
            <div
              className="text-[0.6rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#93C5FD" }}
            >
              Tier 1
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              $2k – $3k
            </div>
            <div className="mt-1 text-[0.68rem] text-muted">Standard setup, decent R/R</div>
          </div>
          <div className="px-5 py-4">
            <div
              className="text-[0.6rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#93C5FD" }}
            >
              Tier 2
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              $4k – $5k
            </div>
            <div className="mt-1 text-[0.68rem] text-muted">Clean setup, higher conviction</div>
          </div>
          <div className="px-5 py-4">
            <div
              className="text-[0.6rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#93C5FD" }}
            >
              Tier 3
            </div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
              $6k – $8k
            </div>
            <div className="mt-1 text-[0.68rem] text-muted">
              All six pillars + strong tape
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 bg-surface/30 px-5 py-3">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            <div className="flex items-baseline gap-3">
              <span
                className="text-[0.6rem] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "#F87171" }}
              >
                Max loss / trade
              </span>
              <span className="font-mono text-base font-semibold tabular-nums">
                $5,000
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted">
                Max open trades
              </span>
              <span className="font-mono text-base font-semibold tabular-nums">
                2 – 3
              </span>
              <span className="text-[0.68rem] text-muted">
                none in the same sector
              </span>
            </div>
          </div>
        </div>
      </section>

      <EdgeChecklist vertical />

      <section className="card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-3 flex items-baseline justify-between">
          <div>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
              Top 10 Tickers
            </div>
            <div
              className="mt-1 text-sm font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              What I actually make money on
            </div>
          </div>
          <div className="text-[0.62rem] uppercase tracking-wider text-dim">
            Ranked by profit factor · min 2 trades · profitable only
          </div>
        </div>
        {topTickers.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">
            Not enough history yet. Trade more and this will populate.
          </div>
        ) : (
          <ol className="grid grid-cols-1 divide-y divide-border/60 md:grid-cols-2 md:divide-x md:divide-y-0">
            {[0, 1].map((col) => (
              <div key={col} className="divide-y divide-border/60">
                {topTickers.slice(col * 5, col * 5 + 5).map((t, idx) => {
                  const rank = col * 5 + idx + 1;
                  return (
                    <li
                      key={t.ticker}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      <span
                        className="font-mono text-[0.7rem] font-semibold tabular-nums text-dim w-5"
                      >
                        {String(rank).padStart(2, "0")}
                      </span>
                      <span
                        className="font-mono text-base font-semibold tracking-tight flex-1"
                      >
                        ${t.ticker}
                      </span>
                      <span className="text-[0.68rem] text-muted w-14 tabular-nums">
                        {t.wins}W / {t.losses}L
                      </span>
                      <span
                        className="font-mono text-sm font-semibold tabular-nums w-20 text-right"
                        style={{ color: "#4ADE80" }}
                      >
                        {t.pf == null ? "all wins" : `${t.pf.toFixed(2)} PF`}
                      </span>
                    </li>
                  );
                })}
              </div>
            ))}
          </ol>
        )}
      </section>

      <div className="text-center text-[0.7rem] uppercase tracking-[0.28em] text-muted">
        If any pillar is missing, it&apos;s not the trade. News is optional.
      </div>
    </div>
  );
}
