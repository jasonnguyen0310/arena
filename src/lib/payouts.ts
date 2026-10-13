import type { Trade, Withdrawal, TradeTrim } from "@/db/schema";

export function dayKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PendingPayout = { date: string; day_pnl: number };

const OPTION_INSTRUMENTS = new Set(["call", "put", "call_spread", "put_spread"]);

export function multiplierFor(instrument: string): number {
  return OPTION_INSTRUMENTS.has(instrument) ? 100 : 1;
}

/**
 * Cost basis of the full trade.
 *
 * Preferred formula: proceeds − pnl (bulletproof when both exit_price and pnl are set).
 * Fallback: entry × planned_size × multiplier — but only when planned_size looks like
 * a contract count (produces a sane cost). If planned_size × entry × mult explodes
 * past $500k, we assume planned_size was actually a dollar amount and use it directly.
 */
export function tradeCostBasis(trade: Trade): number | null {
  const mult = multiplierFor(trade.instrument);

  if (trade.exit_price != null && trade.pnl != null && Number.isFinite(trade.pnl)) {
    const proceeds = trade.exit_price * trade.planned_size * mult;
    const cost = Math.abs(proceeds - trade.pnl);
    if (cost > 0 && cost < 100_000_000) return cost;
  }

  const entry = trade.actual_entry ?? trade.planned_entry;
  if (entry != null) {
    const c = entry * trade.planned_size * mult;
    if (c > 0 && c <= 500_000) return c;
    // planned_size was probably a dollar amount, not contracts
    if (trade.planned_size > 0 && trade.planned_size < 1_000_000) return trade.planned_size;
  }
  return null;
}

/**
 * Cost basis of a trim.
 * Preferred: (trim.price × contracts × multiplier) − trim.pnl — exact when trim.pnl is set.
 * Fallback: entry × contracts × multiplier.
 */
export function trimCostBasis(trim: TradeTrim, trade: Trade): number | null {
  const mult = multiplierFor(trade.instrument);

  if (trim.pnl != null && Number.isFinite(trim.pnl)) {
    const proceeds = trim.price * trim.contracts * mult;
    const cost = proceeds - trim.pnl;
    if (cost > 0) return cost;
  }

  const entry = trade.actual_entry ?? trade.planned_entry;
  if (entry == null) return null;
  return entry * trim.contracts * mult;
}

/** Format a P&L as a percent of cost basis, e.g. "+12.4%". Returns null when either input is missing. */
export function fmtPct(pnl: number | null | undefined, cost: number | null | undefined): string | null {
  if (pnl == null || cost == null || cost === 0) return null;
  const p = (pnl / Math.abs(cost)) * 100;
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

/**
 * Percent change from entry to exit price, e.g. "+55.6%".
 * Direction-aware: "short" flips the sign so a lower exit = positive %.
 * Returns null when either price is missing or entry is 0.
 */
export function fmtPricePct(
  entry: number | null | undefined,
  exit: number | null | undefined,
  direction: string = "long",
): string | null {
  if (entry == null || exit == null || entry === 0) return null;
  const sign = direction === "short" ? -1 : 1;
  const p = ((exit - entry) / entry) * 100 * sign;
  const s = p >= 0 ? "+" : "";
  return `${s}${p.toFixed(1)}%`;
}

export function trimPnl(trim: TradeTrim, trade: Trade): number | null {
  if (trim.pnl != null && Number.isFinite(trim.pnl)) return trim.pnl;
  const entry = trade.actual_entry ?? trade.planned_entry;
  if (entry == null) return null;
  const dir = trade.direction === "short" ? -1 : 1;
  return (trim.price - entry) * trim.contracts * multiplierFor(trade.instrument) * dir;
}

/**
 * Daily realized P&L by opened_at date, considering ONLY closed trades.
 * Open-trade trims are intentionally excluded — unrealized paper gains don't
 * qualify for the 60/40 rule until the trade is actually closed.
 */
export function closedTradeDailyPnl(allTrades: Trade[]): Map<string, number> {
  const dailyNet = new Map<string, number>();
  for (const t of allTrades) {
    if (!t.closed_at) continue;
    const k = dayKeyLocal(t.opened_at);
    dailyNet.set(k, (dailyNet.get(k) ?? 0) + (t.pnl ?? 0));
  }
  return dailyNet;
}

export function computePendingPayouts(
  allTrades: Trade[],
  withdrawals: Withdrawal[],
  // trims kept in signature for backwards call compatibility; now unused.
  _trims: TradeTrim[] = [],
): PendingPayout[] {
  const dailyNet = closedTradeDailyPnl(allTrades);

  // Sum of prior acknowledgements per day (in case a day was paid out multiple times)
  const paidByDay = new Map<string, number>();
  for (const w of withdrawals) {
    paidByDay.set(w.date, (paidByDay.get(w.date) ?? 0) + w.day_pnl);
  }

  return [...dailyNet.entries()]
    .map(([date, net]) => ({ date, remaining: net - (paidByDay.get(date) ?? 0) }))
    .filter((r) => r.remaining > 0.01)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ date, remaining }) => ({ date, day_pnl: remaining }));
}

/**
 * Effective lifetime payout: 60/40 of only the realized green-day P&L that
 * actually stuck. Acknowledgements for days that later closed red (or at a
 * smaller gain) are capped at the real attributed day P&L.
 */
export function computeEffectivePayoutTotals(
  allTrades: Trade[],
  withdrawals: Withdrawal[],
): { paid: number; kept: number; realizedGreenPnl: number } {
  const dailyNet = closedTradeDailyPnl(allTrades);
  const ackByDay = new Map<string, number>();
  for (const w of withdrawals) {
    ackByDay.set(w.date, (ackByDay.get(w.date) ?? 0) + w.day_pnl);
  }

  let realizedGreenPnl = 0;
  for (const [date, ack] of ackByDay) {
    const actual = Math.max(0, dailyNet.get(date) ?? 0);
    realizedGreenPnl += Math.min(ack, actual);
  }

  return {
    paid: realizedGreenPnl * 0.6,
    kept: realizedGreenPnl * 0.4,
    realizedGreenPnl,
  };
}
