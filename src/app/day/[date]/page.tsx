import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Trade, TradeTrim } from "@/db/schema";
import { trimPnl } from "@/lib/payouts";

export const dynamic = "force-dynamic";

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function pnlColor(n: number) {
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

function parseDaySlug(slug: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slug)) return null;
  const [y, m, d] = slug.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shortExp(iso: string | null): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

function contractLabel(t: Trade): string {
  if (t.strike == null) return t.instrument.replace("_", " ");
  const suffix = t.instrument === "put" ? "P" : "C";
  const exp = t.expiration ? ` ${shortExp(t.expiration)}` : "";
  return `${t.strike}${suffix}${exp}`;
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date: slug } = await params;
  const target = parseDaySlug(slug);
  if (!target) notFound();

  const [allTrades, allTrims] = await Promise.all([
    db.query.trades.findMany(),
    db.query.trade_trims.findMany(),
  ]);

  const tradesById = new Map(allTrades.map((t) => [t.id, t]));

  // Sum of trim P&L per trade (needed to compute closed-trade residual for opened_at day)
  const trimSumByTrade = new Map<number, number>();
  for (const tr of allTrims) {
    const trade = tradesById.get(tr.trade_id);
    if (!trade) continue;
    const v = trimPnl(tr, trade);
    if (v == null) continue;
    trimSumByTrade.set(tr.trade_id, (trimSumByTrade.get(tr.trade_id) ?? 0) + v);
  }

  // Trims taken this day (open OR closed trades)
  const trimsOnDay: { trade: Trade; trim: TradeTrim; pnl: number }[] = [];
  for (const tr of allTrims) {
    const trade = tradesById.get(tr.trade_id);
    if (!trade) continue;
    if (!isSameDay(tr.at, target)) continue;
    const v = trimPnl(tr, trade) ?? 0;
    trimsOnDay.push({ trade, trim: tr, pnl: v });
  }

  // Closed trades whose opened_at is this day. Their RESIDUAL P&L (excl. already-counted trims)
  // gets attributed to this day.
  const closedOpenedOnDay = allTrades.filter(
    (t) => t.closed_at != null && isSameDay(t.opened_at, target),
  );

  // Positions still open that were OPENED on this day (won't have P&L yet)
  const openedTodayStillOpen = allTrades.filter(
    (t) => t.closed_at == null && isSameDay(t.opened_at, target),
  );

  // Day P&L: residual on closed trades opened today + all trims taken today
  const closedResidualPnl = closedOpenedOnDay.reduce(
    (s, t) => s + ((t.pnl ?? 0) - (trimSumByTrade.get(t.id) ?? 0)),
    0,
  );
  const trimsPnl = trimsOnDay.reduce((s, x) => s + x.pnl, 0);
  const dayTotal = closedResidualPnl + trimsPnl;
  // For UI convenience keep this name
  const closedOnDay = closedOpenedOnDay;
  const closedPnl = closedResidualPnl;
  const openTrimsToday = trimsOnDay.map(({ trade, trim }) => ({ trade, trim }));

  // Sort closed by residual return %. residual = trade.pnl minus trims already booked
  // on their own days.
  const closedRows = closedOnDay
    .map((t) => {
      const cost = tradeCostDollars(t);
      const totalPnl = t.pnl ?? 0;
      const residual = totalPnl - (trimSumByTrade.get(t.id) ?? 0);
      const ret = cost > 0 ? (residual / cost) * 100 : null;
      return { t, ret, pnl: residual, totalPnl };
    })
    .sort((a, b) => (b.ret ?? -999) - (a.ret ?? -999));

  // W/L on the day is based on TOTAL trade P&L (win/loss of the whole trade),
  // not just the residual on this day. A trade can be a big total winner even if
  // its residual on opened_at is small.
  const wins = closedRows.filter((r) => (r.totalPnl ?? 0) > 0).length;
  const losses = closedRows.filter((r) => (r.totalPnl ?? 0) < 0).length;
  const scratches = closedRows.filter((r) => (r.totalPnl ?? 0) === 0).length;

  const label = target.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Prev / next day slugs
  const prev = new Date(target);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(target);
  next.setDate(next.getDate() + 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const empty =
    closedOnDay.length === 0 && openTrimsToday.length === 0 && openedTodayStillOpen.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Trading day
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{label}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link href={`/day/${fmt(prev)}`} className="btn btn-ghost !py-1.5 !px-3">◂ Prev</Link>
          <Link href="/" className="btn btn-ghost !py-1.5 !px-3">Calendar</Link>
          <Link href={`/day/${fmt(next)}`} className="btn btn-ghost !py-1.5 !px-3">Next ▸</Link>
        </div>
      </div>

      {empty ? (
        <div className="card p-10 text-center text-muted">No activity on this day.</div>
      ) : (
        <>
          {/* Summary cards */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="card p-5 md:col-span-2">
              <div className="text-xs font-medium text-muted">Day P&amp;L</div>
              <div
                className="pnl-value mt-2 font-mono text-3xl font-bold tabular-nums"
                style={{ color: pnlColor(dayTotal) }}
              >
                {fmtMoney(dayTotal)}
              </div>
              <div className="mt-1 text-[0.68rem] text-dim">
                closed {fmtMoney(closedPnl)} · trims {fmtMoney(trimsPnl)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Trades closed</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {closedOnDay.length}
              </div>
              <div className="mt-1 text-[0.68rem] text-dim">
                {wins}W · {losses}L{scratches > 0 ? ` · ${scratches}S` : ""}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Trims banked</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {openTrimsToday.length}
              </div>
              <div className="mt-1 text-[0.68rem] text-dim">on open positions</div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-medium text-muted">Opened, still open</div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {openedTodayStillOpen.length}
              </div>
              <div className="mt-1 text-[0.68rem] text-dim">running into next week</div>
            </div>
          </section>

          {/* Closed trades table */}
          {closedRows.length > 0 && (
            <section className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                Closed trades opened this day · residual after trims
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2">Contract</th>
                    <th className="px-4 py-2">Setup</th>
                    <th className="px-4 py-2 text-right">Entry</th>
                    <th className="px-4 py-2 text-right">Exit</th>
                    <th className="px-4 py-2 text-right">P&amp;L</th>
                    <th className="px-4 py-2 text-right">Return</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {closedRows.map(({ t, ret, pnl }) => (
                    <tr key={t.id} className="hover:bg-surface/40">
                      <td className="px-4 py-2 font-mono font-semibold">{t.ticker}</td>
                      <td className="px-4 py-2 text-xs text-muted">{contractLabel(t)}</td>
                      <td className="px-4 py-2 text-xs text-muted">{t.setup_type?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">
                        ${(t.actual_entry ?? t.planned_entry ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">
                        {t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className="px-4 py-2 text-right font-mono font-semibold tabular-nums"
                        style={{ color: pnlColor(pnl) }}
                      >
                        {fmtMoney(pnl)}
                      </td>
                      <td
                        className="px-4 py-2 text-right font-mono font-semibold tabular-nums"
                        style={{ color: pnlColor(ret ?? 0) }}
                      >
                        {fmtPct(ret)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/trades/${t.id}/edit`}
                          className="text-[0.68rem] text-muted hover:text-text"
                        >
                          view →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Trims taken this day (open or closed trades) */}
          {openTrimsToday.length > 0 && (
            <section className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                Trims taken this day
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2">Contract</th>
                    <th className="px-4 py-2 text-right">Contracts</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Entry</th>
                    <th className="px-4 py-2 text-right">P&amp;L</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openTrimsToday
                    .map(({ trade, trim }) => ({
                      trade,
                      trim,
                      p: trimPnl(trim, trade) ?? 0,
                    }))
                    .sort((a, b) => b.p - a.p)
                    .map(({ trade, trim, p }) => (
                      <tr key={trim.id} className="hover:bg-surface/40">
                        <td className="px-4 py-2 font-mono font-semibold">{trade.ticker}</td>
                        <td className="px-4 py-2 text-xs text-muted">{contractLabel(trade)}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{trim.contracts}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">${trim.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          ${(trade.actual_entry ?? trade.planned_entry ?? 0).toFixed(2)}
                        </td>
                        <td
                          className="px-4 py-2 text-right font-mono font-semibold tabular-nums"
                          style={{ color: pnlColor(p) }}
                        >
                          {fmtMoney(p)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/trades/${trade.id}/edit`}
                            className="text-[0.68rem] text-muted hover:text-text"
                          >
                            view →
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Positions opened today, still open */}
          {openedTodayStillOpen.length > 0 && (
            <section className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                Opened today, still open
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface/40 text-left text-[0.62rem] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2">Contract</th>
                    <th className="px-4 py-2">Setup</th>
                    <th className="px-4 py-2 text-right">Entry</th>
                    <th className="px-4 py-2 text-right">Size ($)</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openedTodayStillOpen.map((t) => (
                    <tr key={t.id} className="hover:bg-surface/40">
                      <td className="px-4 py-2 font-mono font-semibold">{t.ticker}</td>
                      <td className="px-4 py-2 text-xs text-muted">{contractLabel(t)}</td>
                      <td className="px-4 py-2 text-xs text-muted">{t.setup_type?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">
                        ${(t.actual_entry ?? t.planned_entry ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-muted">
                        {t.planned_size >= 100 ? `$${t.planned_size.toLocaleString()}` : `${t.planned_size}c`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/trades/${t.id}/edit`}
                          className="text-[0.68rem] text-muted hover:text-text"
                        >
                          view →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
