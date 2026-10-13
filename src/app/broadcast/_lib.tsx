import Link from "next/link";
import { desc, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Trade, TradeTrim } from "@/db/schema";

export type DiscordAlert = {
  ticker: string;
  strike: number;
  expiration: string;
  qty: number;              // broadcast BUY qty
  entryPrice: number;
  // Broadcast SELL alerts against this position. Ordered chronologically.
  sells?: { qty: number; price: number; date: string /* YYYY-MM-DD */ }[];
  // Only true when Discord broadcasts a formal "fully out" — position closed.
  closed?: boolean;
};

export const DISCORD_ALERTS: DiscordAlert[] = [
  // ── week of 8/24 ────────────────────────────
  { ticker: "TSLA", strike: 360,  expiration: "8/28", qty: 10, entryPrice: 4.50 },
  { ticker: "BE",   strike: 220,  expiration: "8/28", qty: 20, entryPrice: 2.00 },
  { ticker: "SNDK", strike: 1900, expiration: "9/4",  qty: 5,  entryPrice: 8.30 },
  { ticker: "META", strike: 600,  expiration: "9/18", qty: 25, entryPrice: 6.60 },
  { ticker: "MU",   strike: 950,  expiration: "8/26", qty: 10, entryPrice: 10.00 },
  { ticker: "MRNA", strike: 170,  expiration: "8/28", qty: 30, entryPrice: 3.80 },
  { ticker: "AAPL", strike: 320,  expiration: "9/4",  qty: 40, entryPrice: 1.64 },
  { ticker: "META", strike: 600,  expiration: "8/28", qty: 50, entryPrice: 1.60 },
  { ticker: "CIEN", strike: 420,  expiration: "8/28", qty: 20, entryPrice: 3.88 },
  {
    ticker: "BE", strike: 250, expiration: "9/18", qty: 20, entryPrice: 9.60,
    sells: [
      { qty: 10, price: 12.60, date: "2026-09-03" },
      { qty: 15, price: 16.40, date: "2026-09-04" },
    ],
    // NOT marked closed — Discord hasn't broadcast a full exit yet.
  },
  { ticker: "ARM",  strike: 270,  expiration: "8/28", qty: 20, entryPrice: 2.80 },
  { ticker: "ALAB", strike: 315,  expiration: "8/28", qty: 20, entryPrice: 3.60 },
  { ticker: "MSFT", strike: 505,  expiration: "8/28", qty: 20, entryPrice: 1.65 },
  { ticker: "CRWD", strike: 240,  expiration: "8/8",  qty: 20, entryPrice: 2.33 },
  { ticker: "AVGO", strike: 370,  expiration: "8/28", qty: 20, entryPrice: 3.66 },
  { ticker: "MU",   strike: 960,  expiration: "8/28", qty: 30, entryPrice: 2.25 },

  // ── week of 8/31 ────────────────────────────
  {
    ticker: "SPY", strike: 767, expiration: "9/4", qty: 50, entryPrice: 2.02,
    sells: [
      { qty: 25, price: 2.50, date: "2026-09-02" },
      // "fully exited, just choppin premiums" — remaining 25 sold at Arena's exit price.
      { qty: 25, price: 2.40, date: "2026-09-02" },
    ],
    closed: true,
  },
  {
    ticker: "INTC", strike: 95, expiration: "9/4", qty: 50, entryPrice: 0.35,
    // Closed at breakeven per user.
    sells: [{ qty: 50, price: 0.35, date: "2026-09-04" }],
    closed: true,
  },
  {
    ticker: "MSFT", strike: 515, expiration: "9/4", qty: 20, entryPrice: 2.40,
    // Sells scaled proportionally from Arena's trim record (35, 5, 5, remaining).
    sells: [
      { qty: 15, price: 2.70, date: "2026-09-03" },
      { qty: 2,  price: 3.27, date: "2026-09-03" },
      { qty: 2,  price: 3.10, date: "2026-09-03" },
      { qty: 1,  price: 0.07, date: "2026-09-04" },
    ],
    closed: true,
  },
  { ticker: "TSLA", strike: 380,  expiration: "9/4",  qty: 20, entryPrice: 4.95 },
  { ticker: "TSLA", strike: 400,  expiration: "9/9",  qty: 20, entryPrice: 2.40 },
  {
    ticker: "NBIS", strike: 280, expiration: "9/11", qty: 50, entryPrice: 3.70,
    sells: [
      { qty: 25, price: 5.52, date: "2026-09-04" },
      { qty: 15, price: 8.00, date: "2026-09-04" },
    ],
    // 40 of 50 sold — still open per Discord.
  },
  {
    ticker: "SNDK", strike: 1850, expiration: "9/11", qty: 10, entryPrice: 9.81,
    sells: [
      { qty: 5, price: 18.00, date: "2026-09-04" },
      { qty: 3, price: 25.00, date: "2026-09-04" },
    ],
    // Only 8 of 10 sold — position still open per Discord.
  },
  { ticker: "SNDK", strike: 1850, expiration: "9/4",  qty: 3,  entryPrice: 8.50 },
  {
    ticker: "SNDK", strike: 1680, expiration: "9/4", qty: 6, entryPrice: 9.50,
    sells: [
      { qty: 3, price: 25.30, date: "2026-09-04" },
      { qty: 3, price: 39.00, date: "2026-09-04" },
    ],
    closed: true, // 3 + 3 = 6, matches qty
  },
  {
    ticker: "MU", strike: 1060, expiration: "9/11", qty: 10, entryPrice: 10.38,
    sells: [{ qty: 3, price: 15.20, date: "2026-09-04" }],
    // 3 of 10 sold — still open per Discord.
  },
  { ticker: "AMD",  strike: 500,  expiration: "9/18", qty: 5,  entryPrice: 9.30 },
];

function shortExpir(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

function findAlert(trade: Trade): DiscordAlert | null {
  // If Arena has strike + expiration, require a strict match. No fallback —
  // we don't want MU 980 accidentally scaling to MU 1060 just because the entry
  // prices are close.
  if (trade.strike != null && trade.expiration) {
    const exp = shortExpir(trade.expiration);
    if (!exp) return null;
    return (
      DISCORD_ALERTS.find(
        (a) => a.ticker === trade.ticker && a.strike === trade.strike && a.expiration === exp,
      ) ?? null
    );
  }
  // Legacy Arena trades (no strike/expiration stored): fall back to ticker + entry price.
  const entry = trade.actual_entry ?? trade.planned_entry;
  if (entry == null) return null;
  const candidates = DISCORD_ALERTS.filter(
    (a) => a.ticker === trade.ticker && Math.abs(a.entryPrice - entry) <= 0.35,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pnlColor(n: number) {
  if (n > 0) return "var(--color-win)";
  if (n < 0) return "var(--color-loss)";
  return "var(--color-scratch)";
}

/** Monday 00:00 → next Monday 00:00 (local time) of the week containing `d`. */
export function weekBounds(d: Date): { start: Date; end: Date } {
  const dow = d.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** yyyy-mm-dd for the Monday of the week containing `d`. */
export function weekSlug(d: Date): string {
  const { start } = weekBounds(d);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

export function slugToDate(slug: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) return null;
  const [y, m, d] = slug.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtWeekRange(start: Date, end: Date): string {
  const fri = new Date(end);
  fri.setDate(fri.getDate() - 3);
  const s = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = fri.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

/** All week slugs (Monday dates) that contain at least one closed trade. Newest first. */
async function listWeeks(): Promise<string[]> {
  const rows = await db.query.trades.findMany({
    where: isNotNull(schema.trades.closed_at),
    columns: { closed_at: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.closed_at) set.add(weekSlug(r.closed_at));
  }
  return [...set].sort((a, b) => (a < b ? 1 : -1));
}

// Tickers to hide when they don't match a Discord alert (personal trades).
// Matched Discord alerts on these tickers (e.g. MU 1060, META 600) still show.
const EXCLUDE_UNMATCHED = new Set([
  "DELL", "MRVL", "MSTR", "COIN", "CRWD", "PANW", "SPX", "LULU", "MU", "META",
]);

type ClosedRow = {
  id: string;
  date: Date;
  ticker: string;
  contract: string;
  entry: number;
  exitLabel: string;
  qty: number;
  pnl: number;
  source: "discord" | "arena";
};

type OpenTrimRow = {
  id: string;
  date: Date;
  ticker: string;
  contract: string;
  entry: number;
  trimPrices: number[];
  qty: number;
  pnl: number;
  source: "discord" | "arena";
};

function contractLabel(ticker: string, strike: number | null | undefined, expiration: string | null | undefined, instrument = "call"): string {
  const suffix = instrument === "put" ? "P" : "C";
  if (strike == null) return ticker;
  const exp = expiration ? ` ${shortExpir(expiration) ?? expiration}` : "";
  return `${strike}${suffix}${exp}`;
}

function dateFromSlug(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

async function loadWeek(start: Date, end: Date) {
  const [allClosed, allTrims, openTrades] = await Promise.all([
    db.query.trades.findMany({
      where: isNotNull(schema.trades.closed_at),
      orderBy: desc(schema.trades.closed_at),
    }),
    db.query.trade_trims.findMany(),
    db.query.trades.findMany({ where: isNull(schema.trades.closed_at) }),
  ]);

  const closedRows: ClosedRow[] = [];
  const openTrimRows: OpenTrimRow[] = [];

  // ── Discord-driven rows ────────────────────────────────────
  // For each alert, look at its sells; anything falling in this week produces a row.
  const alertsSeenThisWeek = new Set<string>();
  for (const a of DISCORD_ALERTS) {
    const key = `${a.ticker}|${a.strike}|${a.expiration}|${a.entryPrice}`;
    const sells = a.sells ?? [];
    // Only consider alerts with sells in this window
    const sellsInWeek = sells.filter((s) => {
      const d = dateFromSlug(s.date);
      return d >= start && d < end;
    });
    // For rows to appear, either the sells hit this week, OR closed alert whose sells were this week
    if (sellsInWeek.length === 0) continue;
    alertsSeenThisWeek.add(key);

    // Aggregate ALL sells (for fully-closed weighted avg or trim list). Row date = last sell in week.
    const lastSellDate = dateFromSlug(sellsInWeek[sellsInWeek.length - 1].date);
    const contract = `${a.strike}C ${a.expiration}`;
    const dirSign = 1; // options long-call assumed here (no put/short broadcasts)

    if (a.closed) {
      // Fully closed — weighted avg exit across ALL sells
      const totalSold = sells.reduce((s, x) => s + x.qty, 0);
      const wavg = totalSold > 0
        ? sells.reduce((s, x) => s + x.qty * x.price, 0) / totalSold
        : a.entryPrice;
      const pnl = (wavg - a.entryPrice) * a.qty * 100 * dirSign;
      closedRows.push({
        id: `alert-${key}`,
        date: lastSellDate,
        ticker: a.ticker,
        contract,
        entry: a.entryPrice,
        exitLabel: sells.map((s) => `$${s.price.toFixed(2)}`).join(", ") + " (ALL OUT)",
        qty: a.qty,
        pnl,
      source: "discord",
      });
    } else {
      // Open with trims — sum realized P&L on sells so far
      let trimPnl = 0;
      let trimQty = 0;
      for (const s of sells) {
        const q = Math.min(s.qty, a.qty - trimQty); // cap at broadcast qty
        if (q <= 0) break;
        trimPnl += (s.price - a.entryPrice) * q * 100 * dirSign;
        trimQty += q;
      }
      openTrimRows.push({
        id: `alert-${key}`,
        date: lastSellDate,
        ticker: a.ticker,
        contract,
        entry: a.entryPrice,
        trimPrices: sells.map((s) => s.price),
        qty: trimQty,
        pnl: trimPnl,
      source: "discord",
      });
    }
  }

  // ── Arena fallback ─────────────────────────────────────────
  // Include unmatched Arena trades in the week (not in EXCLUDE_UNMATCHED, not already covered by Discord).
  const closedThisWeek = allClosed.filter(
    (t) => t.closed_at != null && t.closed_at >= start && t.closed_at < end,
  );
  const arenaTrimsByTrade = new Map<number, TradeTrim[]>();
  for (const tr of allTrims) {
    const arr = arenaTrimsByTrade.get(tr.trade_id) ?? [];
    arr.push(tr);
    arenaTrimsByTrade.set(tr.trade_id, arr);
  }
  for (const t of closedThisWeek) {
    const matched = findAlert(t);
    if (matched) continue;
    if (EXCLUDE_UNMATCHED.has(t.ticker)) continue;
    const entry = t.actual_entry ?? t.planned_entry;
    if (entry == null) continue;
    const exit = t.exit_price;
    if (exit == null) continue;
    const derivedContracts = t.planned_size < 100 ? t.planned_size : t.planned_size / (entry * 100);
    const dirSign = t.direction === "short" ? -1 : 1;
    // Sum trade.pnl + trim.pnl values (compute trim pnl from prices when stored as 0/null).
    const trims = (arenaTrimsByTrade.get(t.id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
    let extraFromTrims = 0;
    for (const tr of trims) {
      const p = tr.pnl && tr.pnl !== 0 ? tr.pnl : (tr.price - entry) * tr.contracts * 100 * dirSign;
      extraFromTrims += p;
    }
    const totalPnl = (t.pnl ?? 0) + extraFromTrims;
    const trimPricesList = trims.map((x) => `$${x.price.toFixed(2)}`).join(", ");
    const exitLabel = trimPricesList
      ? `${trimPricesList}, $${exit.toFixed(2)} (ALL OUT)`
      : `$${exit.toFixed(2)} (ALL OUT)`;
    closedRows.push({
      id: `arena-${t.id}`,
      date: t.closed_at!,
      ticker: t.ticker,
      contract: contractLabel(t.ticker, t.strike, t.expiration, t.instrument),
      entry,
      exitLabel,
      qty: Math.max(1, Math.round(derivedContracts)),
      pnl: totalPnl,
      source: "arena",
    });
  }
  // Open Arena trims for unmatched tickers (arena fallback for open positions with trims this week)
  const openTradesById = new Map(openTrades.map((t) => [t.id, t]));
  const trimsByTrade = new Map<number, TradeTrim[]>();
  for (const tr of allTrims) {
    const arr = trimsByTrade.get(tr.trade_id) ?? [];
    arr.push(tr);
    trimsByTrade.set(tr.trade_id, arr);
  }
  const seenTradeIds = new Set<number>();
  for (const tr of allTrims) {
    if (tr.at < start || tr.at >= end) continue;
    if (seenTradeIds.has(tr.trade_id)) continue;
    const trade = openTradesById.get(tr.trade_id);
    if (!trade) continue;
    if (findAlert(trade)) continue; // Discord handled above
    if (EXCLUDE_UNMATCHED.has(trade.ticker)) continue;
    seenTradeIds.add(tr.trade_id);
    const entry = trade.actual_entry ?? trade.planned_entry;
    if (entry == null) continue;
    const allTradeTrims = (trimsByTrade.get(tr.trade_id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
    const dirSign = trade.direction === "short" ? -1 : 1;
    let trimPnl = 0;
    let trimQty = 0;
    for (const t2 of allTradeTrims) {
      const p = t2.pnl && t2.pnl !== 0 ? t2.pnl : (t2.price - entry) * t2.contracts * 100 * dirSign;
      trimPnl += p;
      trimQty += t2.contracts;
    }
    openTrimRows.push({
      id: `arena-trade-${tr.trade_id}`,
      date: tr.at,
      ticker: trade.ticker,
      contract: contractLabel(trade.ticker, trade.strike, trade.expiration, trade.instrument),
      entry,
      trimPrices: allTradeTrims.map((x) => x.price),
      qty: Math.round(trimQty),
      pnl: trimPnl,
      source: "arena",
    });
  }

  closedRows.sort((a, b) => b.pnl - a.pnl);
  openTrimRows.sort((a, b) => b.pnl - a.pnl);
  return { closedRows, openTrimRows };
}

export async function BroadcastWeekView({
  start,
  end,
  isCurrent,
}: {
  start: Date;
  end: Date;
  isCurrent: boolean;
}) {
  const [{ closedRows, openTrimRows }, weeks] = await Promise.all([
    loadWeek(start, end),
    listWeeks(),
  ]);
  const currentSlug = weekSlug(new Date());

  const closedPnl = closedRows.reduce((s, r) => s + r.pnl, 0);
  const openTrimPnl = openTrimRows.reduce((s, r) => s + r.pnl, 0);
  const total = closedPnl + openTrimPnl;
  const wins = closedRows.filter((r) => r.pnl > 0).reduce((s, r) => s + r.pnl, 0);
  const losses = closedRows.filter((r) => r.pnl < 0).reduce((s, r) => s + r.pnl, 0);
  const best = closedRows.length > 0 ? Math.max(...closedRows.map((r) => r.pnl)) : 0;
  const worst = closedRows.length > 0 ? Math.min(...closedRows.map((r) => r.pnl)) : 0;

  const taxRate = 0.37;
  const taxes = total > 0 ? total * taxRate : 0;
  const netAfterTax = total - taxes;
  const payout60 = total > 0 ? total * 0.6 : 0;
  const kept40 = total > 0 ? total * 0.4 : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Broadcast P&L · {fmtWeekRange(start, end)}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {isCurrent ? "This week" : "Weekly recap"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Uses Arena&apos;s entries and exits with the qty broadcast in{" "}
            <span className="font-mono">#jase-trade-alerts</span>. Trades that weren&apos;t broadcast
            use Arena&apos;s actual P&L.
          </p>
        </div>
        <Link href="/" className="btn btn-ghost">← Back</Link>
      </div>

      {/* Week selector */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4 text-xs">
        <span className="mr-2 self-center text-muted">Weeks:</span>
        {weeks.map((slug) => {
          const isSelected = slug === weekSlug(start);
          const isThisWeek = slug === currentSlug;
          const href = isThisWeek ? "/broadcast" : `/broadcast/${slug}`;
          const d = slugToDate(slug);
          const label = d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : slug;
          return (
            <Link
              key={slug}
              href={href}
              className={`rounded-full border px-3 py-1 font-medium tracking-wide transition-colors ${
                isSelected
                  ? "border-text text-text"
                  : "border-border text-muted hover:border-border-hi hover:text-text"
              }`}
            >
              {isThisWeek ? `This week (${label})` : `Wk of ${label}`}
            </Link>
          );
        })}
      </div>

      {closedRows.length === 0 && openTrimRows.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          Nothing broadcast this week.
        </div>
      ) : (
        <>
          <div
            className="card p-6"
            style={{
              background: "linear-gradient(180deg, rgba(74,222,128,0.08), rgba(74,222,128,0.02))",
              border: "1px solid rgba(74,222,128,0.28)",
              boxShadow: "0 0 42px -14px rgba(74,222,128,0.35)",
            }}
          >
            <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">Realized P&L</div>
            <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: pnlColor(total) }}>
              {fmtMoney(total)}
            </div>
            <div className="mt-2 text-xs text-muted">
              {closedRows.length} closed trade{closedRows.length === 1 ? "" : "s"}
              {openTrimRows.length > 0 && ` · ${openTrimRows.length} trim${openTrimRows.length === 1 ? "" : "s"} on open positions`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Wins</div>
              <div className="mt-2 font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--color-win)" }}>{fmtMoney(wins)}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Losses</div>
              <div className="mt-2 font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--color-loss)" }}>{fmtMoney(losses)}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Best</div>
              <div className="mt-2 font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--color-win)" }}>{fmtMoney(best)}</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Worst</div>
              <div className="mt-2 font-mono text-xl font-semibold tabular-nums" style={{ color: "var(--color-loss)" }}>{fmtMoney(worst)}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Post-tax · CA at 37%</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: pnlColor(netAfterTax) }}>
                {fmtMoney(netAfterTax)}
              </div>
              <div className="mt-1 text-xs text-muted">
                gross <span className="font-mono">{fmtMoney(total)}</span> · tax{" "}
                <span className="font-mono">
                  {taxes > 0 ? `-$${taxes.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0.00"}
                </span>
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">60/40 payout</div>
              <div className="mt-2 text-sm">
                Payout{" "}
                <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-win)" }}>
                  +${payout60.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 text-sm">
                Kept in market{" "}
                <span className="font-mono tabular-nums">
                  +${kept40.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {closedRows.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">Closed trades</div>
              <table className="w-full text-sm">
                <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Contract</th>
                    <th className="px-3 py-2 text-right">Entry</th>
                    <th className="px-3 py-2 text-right">Exit</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {closedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/40">
                      <td className="px-3 py-2 text-xs text-muted">{r.date.toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{r.ticker}</td>
                      <td className="px-3 py-2 text-xs text-muted">{r.contract}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {r.entry != null ? `$${r.entry.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{r.exitLabel}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {Number.isInteger(r.qty) ? r.qty : r.qty.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums" style={{ color: pnlColor(r.pnl) }}>
                        {fmtMoney(r.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                      Closed subtotal · {closedRows.length} trades
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-lg font-bold tabular-nums" style={{ color: pnlColor(closedPnl) }}>
                      {fmtMoney(closedPnl)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {openTrimRows.length > 0 && (
            <>
            <div className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                Trims banked on open positions · still running
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Contract</th>
                    <th className="px-3 py-2 text-right">Entry</th>
                    <th className="px-3 py-2 text-right">Trim Prices</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openTrimRows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/40">
                      <td className="px-3 py-2 text-xs text-muted">{r.date.toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{r.ticker}</td>
                      <td className="px-3 py-2 text-xs text-muted">{r.contract}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {r.entry != null ? `$${r.entry.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {r.trimPrices.map((p) => `$${p.toFixed(2)}`).join(", ")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{r.qty}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums" style={{ color: pnlColor(r.pnl) }}>
                        {fmtMoney(r.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                      Trim subtotal · {openTrimRows.length} trims · positions still open
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-lg font-bold tabular-nums" style={{ color: pnlColor(openTrimPnl) }}>
                      {fmtMoney(openTrimPnl)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}

          {(closedRows.length > 0 || openTrimRows.length > 0) && (
            <div
              className="card p-6"
              style={{
                background: "linear-gradient(180deg, rgba(74,222,128,0.10), rgba(74,222,128,0.02))",
                border: "1px solid rgba(74,222,128,0.35)",
                boxShadow: "0 0 42px -14px rgba(74,222,128,0.4)",
              }}
            >
              <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                Grand total · week P&L
              </div>
              <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: pnlColor(total) }}>
                {fmtMoney(total)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                <span>
                  Closed:{" "}
                  <span className="pnl-value font-mono tabular-nums" style={{ color: pnlColor(closedPnl) }}>
                    {fmtMoney(closedPnl)}
                  </span>
                </span>
                <span>
                  Trims (open):{" "}
                  <span className="pnl-value font-mono tabular-nums" style={{ color: pnlColor(openTrimPnl) }}>
                    {fmtMoney(openTrimPnl)}
                  </span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
