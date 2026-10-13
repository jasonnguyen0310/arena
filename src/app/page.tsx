import Link from "next/link";
import { isNull, isNotNull, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeStats } from "@/lib/stats";
import type { Trade } from "@/db/schema";
import DailyGauge from "./DailyGauge";
import PostTaxCard from "./PostTaxCard";
import SessionScope from "./SessionScope";
import { trimPnl, fmtPct as fmtPctOfCost } from "@/lib/payouts";
import type { TradeTrim } from "@/db/schema";
import { acknowledgeWithdrawal, undoWithdrawal } from "./withdrawal-actions";
import { getTaxRate } from "./settings-actions";
import { computePendingPayouts, computeEffectivePayoutTotals, dayKeyLocal } from "@/lib/payouts";

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtMoneyCompact(n: number) {
  if (n === 0) return "0";
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function pnlClass(n: number | null | undefined) {
  if (n == null || n === 0) return "text-scratch";
  return n > 0 ? "text-win" : "text-loss";
}

function TodaySessionCard({ openCount, closedToday }: { openCount: number; closedToday: number }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Today&apos;s session
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{dateStr}</div>
        </div>
        <div className="text-xs text-muted">
          Every moment in the market is unique.
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
        <div>
          <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Active positions
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{openCount}</div>
        </div>
        <div>
          <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Closed today
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{closedToday}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/new" className="btn btn-primary">Open a trade</a>
        <a href="/trades" className="btn btn-ghost">Go to journal</a>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`pnl-value mt-2 font-mono text-2xl font-semibold tabular-nums ${valueClass ?? ""}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function MonthlyPnL({
  closed,
  open,
  trims,
}: {
  closed: Trade[];
  open: Trade[];
  trims: TradeTrim[];
}) {
  // Same attribution rule as the daily calendar:
  //   • closed trade's full pnl → the month it was OPENED (the day risk began)
  //   • open trade's trims → the trim.at month (partials realized so far)
  // Using closed_at would dump cross-month swings onto the close month and
  // distort attribution (e.g. a Sept HOOD swing closing worthless in Oct
  // would make Oct look red even though the risk was taken in Sept).
  const byMonth = new Map<string, { pnl: number; trades: Set<number> }>();
  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (const t of closed) {
    if (t.pnl == null) continue;
    const key = monthKey(new Date(t.opened_at));
    const cur = byMonth.get(key) ?? { pnl: 0, trades: new Set() };
    cur.pnl += t.pnl;
    cur.trades.add(t.id);
    byMonth.set(key, cur);
  }
  const openIds = new Set(open.map((t) => t.id));
  const tradesById = new Map([...closed, ...open].map((t) => [t.id, t]));
  for (const tr of trims) {
    if (!openIds.has(tr.trade_id)) continue; // closed trade trims rolled into trade.pnl above
    const parent = tradesById.get(tr.trade_id);
    if (!parent) continue;
    const v = tr.pnl ?? 0;
    if (v === 0) continue;
    const key = monthKey(new Date(tr.at));
    const cur = byMonth.get(key) ?? { pnl: 0, trades: new Set() };
    cur.pnl += v;
    cur.trades.add(parent.id);
    byMonth.set(key, cur);
  }
  const rows = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 6)
    .map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, year: y, month: m, pnl: v.pnl, trades: v.trades.size };
    });

  if (rows.length === 0) return null;

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  const total = rows.reduce((s, r) => s + r.pnl, 0);

  return (
    <section className="fresh-hidden card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted">
            Monthly P&amp;L
          </div>
          <div className="mt-0.5 text-sm text-muted">
            Last {rows.length} month{rows.length === 1 ? "" : "s"} ·{" "}
            <span className={`font-mono tabular-nums ${pnlClass(total)}`}>
              <span className="pnl-value">{fmtMoney(total)}</span>
            </span>{" "}
            total
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const label = `${MONTH_NAMES[r.month - 1].slice(0, 3)} ${r.year}`;
          const pct = (Math.abs(r.pnl) / maxAbs) * 100;
          const positive = r.pnl >= 0;
          return (
            <li key={r.key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <div className="text-sm font-medium">
                {label}
                <span className="ml-2 text-[0.68rem] text-dim">
                  {r.trades}t
                </span>
              </div>
              <div className="relative h-5 rounded bg-surface/60 overflow-hidden">
                <div
                  className="absolute inset-y-0 rounded"
                  style={{
                    width: `${pct}%`,
                    background: positive
                      ? "rgba(74,222,128,0.35)"
                      : "rgba(248,113,113,0.35)",
                  }}
                />
              </div>
              <div className={`text-right font-mono text-sm tabular-nums ${pnlClass(r.pnl)}`}>
                <span className="pnl-value">{fmtMoney(r.pnl)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseMonthParam(m: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) return { year: y, month: mo - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

function fmtMonthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DayCell = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  pnl: number;
  count: number;
};

function buildMonthGrid(year: number, month: number, byDay: Map<string, { pnl: number; count: number }>): DayCell[] {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sun
  const gridStart = new Date(year, month, 1 - startWeekday);
  const today = new Date();
  const todayKey = dayKey(today);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const k = dayKey(d);
    const data = byDay.get(k) ?? { pnl: 0, count: 0 };
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      isToday: k === todayKey,
      pnl: data.pnl,
      count: data.count,
    });
  }
  return cells;
}

const CAL_WIN = "#4ADE80";
const CAL_LOSS = "#F87171";
const CAL_FLAT = "#FACC15";

function calDayColor(pnl: number, count: number) {
  if (count === 0) return null;
  if (pnl > 0) return CAL_WIN;
  if (pnl < 0) return CAL_LOSS;
  return CAL_FLAT;
}

function CalendarPnL({
  year,
  month,
  closed,
  allTrades,
  trims,
}: {
  year: number;
  month: number;
  closed: Trade[];
  allTrades: Trade[];
  trims: TradeTrim[];
}) {
  const byDay = new Map<string, { pnl: number; count: number }>();
  const tradesById = new Map(allTrades.map((t) => [t.id, t]));

  // Trims (open OR closed trades): attribute each trim to its own trim.at date.
  const trimSumByTrade = new Map<number, number>();
  for (const tr of trims) {
    const trade = tradesById.get(tr.trade_id);
    if (!trade) continue;
    const v = trimPnl(tr, trade);
    if (v == null) continue;
    const k = dayKey(tr.at);
    const cur = byDay.get(k) ?? { pnl: 0, count: 0 };
    cur.pnl += v;
    cur.count += 1;
    byDay.set(k, cur);
    trimSumByTrade.set(tr.trade_id, (trimSumByTrade.get(tr.trade_id) ?? 0) + v);
  }

  // Closed trades: attribute the RESIDUAL P&L (trade.pnl minus already-counted trims)
  // to the OPENED date. Avoids double-counting trims that were already booked above.
  for (const t of closed) {
    const k = dayKey(t.opened_at);
    const residual = (t.pnl ?? 0) - (trimSumByTrade.get(t.id) ?? 0);
    const cur = byDay.get(k) ?? { pnl: 0, count: 0 };
    cur.pnl += residual;
    cur.count += 1;
    byDay.set(k, cur);
  }

  const cells = buildMonthGrid(year, month, byDay);
  const inMonthCells = cells.filter((c) => c.inMonth);
  const monthTotal = inMonthCells.reduce((s, c) => s + c.pnl, 0);
  const monthTradeCount = inMonthCells.reduce((s, c) => s + c.count, 0);
  const tradedDays = inMonthCells.filter((c) => c.count > 0).length;
  const maxAbs = Math.max(1, ...inMonthCells.map((c) => Math.abs(c.pnl)));

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weeks: DayCell[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Calendar</h2>
          <p className="mt-1 text-sm text-muted">Daily net P&amp;L.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/?m=${fmtMonthParam(prev.year, prev.month)}`}
            className="btn btn-ghost !py-1.5 !px-3 text-xs"
            aria-label="Previous month"
          >
            ◂
          </Link>
          <div className="min-w-[10rem] text-center text-sm font-medium">
            {MONTH_NAMES[month]} {year}
          </div>
          <Link
            href={`/?m=${fmtMonthParam(next.year, next.month)}`}
            className="btn btn-ghost !py-1.5 !px-3 text-xs"
            aria-label="Next month"
          >
            ▸
          </Link>
        </div>
      </div>

      <div className="card p-4">
        {/* Month summary strip */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div>
              Net{" "}
              <span
                className="pnl-value ml-1 font-mono text-sm font-semibold tabular-nums"
                style={{ color: calDayColor(monthTotal, monthTradeCount) ?? undefined }}
              >
                {fmtMoney(monthTotal)}
              </span>
            </div>
            <div>
              {monthTradeCount} trade{monthTradeCount === 1 ? "" : "s"} · {tradedDays} day{tradedDays === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* Grid: 7 day columns + 1 week total column */}
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_5.5rem] gap-1.5 text-xs">
          {weekdays.map((w) => (
            <div key={w} className="pb-1 text-center text-[0.68rem] font-medium uppercase tracking-wider text-muted">
              {w}
            </div>
          ))}
          <div className="pb-1 text-center text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Week
          </div>

          {weeks.map((week, wi) => {
            const weekTotal = week.filter((c) => c.inMonth).reduce((s, c) => s + c.pnl, 0);
            const weekCount = week.filter((c) => c.inMonth).reduce((s, c) => s + c.count, 0);
            return (
              <div key={wi} className="contents">
                {week.map((c, ci) => {
                  const color = c.inMonth ? calDayColor(c.pnl, c.count) : null;
                  const intensity = color && c.pnl !== 0
                    ? Math.min(1, Math.abs(c.pnl) / maxAbs)
                    : 0;
                  const bg = color
                    ? c.pnl === 0
                      ? `rgba(250, 204, 21, 0.10)`
                      : color === CAL_WIN
                      ? `rgba(74, 222, 128, ${0.08 + intensity * 0.20})`
                      : `rgba(248, 113, 113, ${0.08 + intensity * 0.20})`
                    : "transparent";
                  const border = color
                    ? `1px solid ${color}44`
                    : c.inMonth
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "1px solid rgba(255,255,255,0.03)";
                  const todayRing = c.isToday
                    ? "0 0 0 1px rgba(255,255,255,0.55), 0 0 12px rgba(255,255,255,0.25)"
                    : "none";
                  const daySlug = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}-${String(c.date.getDate()).padStart(2, "0")}`;
                  const clickable = c.inMonth && c.count > 0;
                  const cellInner = (
                    <>
                      <div className="flex items-start justify-between">
                        <span className={`text-[0.68rem] ${c.isToday ? "font-bold text-text" : "text-muted"}`}>
                          {c.date.getDate()}
                        </span>
                        {c.count > 0 && c.inMonth && (
                          <span
                            className="rounded-full px-1.5 text-[0.62rem] font-semibold tabular-nums"
                            style={{
                              background: color ? `${color}22` : "rgba(255,255,255,0.05)",
                              color: color ?? "var(--color-muted)",
                              border: `1px solid ${color ? `${color}44` : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            {c.count}
                          </span>
                        )}
                      </div>
                      {c.count > 0 && c.inMonth && (
                        <div
                          className="pnl-value mt-1 font-mono text-[0.72rem] font-semibold tabular-nums"
                          style={{ color: color ?? undefined }}
                        >
                          {fmtMoneyCompact(c.pnl)}
                        </div>
                      )}
                      {c.count > 0 && c.inMonth && (
                        <div className="mt-0.5 text-[0.55rem] uppercase tracking-wider text-muted">
                          {c.count === 1 ? "1 trade" : `${c.count} trades`}
                        </div>
                      )}
                    </>
                  );
                  return clickable ? (
                    <Link
                      key={ci}
                      href={`/day/${daySlug}`}
                      className="relative aspect-[1.1/1] rounded-md p-1.5 transition-transform hover:scale-[1.03] hover:brightness-110"
                      style={{ background: bg, border, boxShadow: todayRing, display: "block" }}
                    >
                      {cellInner}
                    </Link>
                  ) : (
                    <div
                      key={ci}
                      className={`relative aspect-[1.1/1] rounded-md p-1.5 ${c.inMonth ? "" : "opacity-30"}`}
                      style={{ background: bg, border, boxShadow: todayRing }}
                    >
                      {cellInner}
                    </div>
                  );
                })}
                {/* Week total */}
                {(() => {
                  const weekColor = calDayColor(weekTotal, weekCount);
                  return (
                    <div
                      className="flex flex-col items-end justify-center rounded-md p-1.5 text-right"
                      style={{
                        background: weekColor
                          ? weekTotal === 0
                            ? "rgba(250, 204, 21, 0.08)"
                            : weekColor === CAL_WIN
                            ? "rgba(74, 222, 128, 0.08)"
                            : "rgba(248, 113, 113, 0.08)"
                          : "var(--color-surface)",
                        border: weekColor
                          ? `1px solid ${weekColor}33`
                          : "1px solid var(--color-border)",
                      }}
                    >
                      <div
                        className="pnl-value font-mono text-[0.72rem] font-semibold tabular-nums"
                        style={{ color: weekColor ?? undefined }}
                      >
                        {weekCount > 0 ? fmtMoneyCompact(weekTotal) : "—"}
                      </div>
                      <div className="text-[0.6rem] text-dim">
                        {weekCount > 0 ? `${weekCount} trade${weekCount === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { year, month } = parseMonthParam(m);

  const [open, closed, states, withdrawals, taxRate, allTrims] = await Promise.all([
    db.query.trades.findMany({ where: isNull(schema.trades.closed_at) }),
    db.query.trades.findMany({ where: isNotNull(schema.trades.closed_at) }),
    db.query.daily_states.findMany({
      orderBy: desc(schema.daily_states.date),
      limit: 14,
    }),
    db.query.withdrawals.findMany({
      orderBy: desc(schema.withdrawals.date),
    }),
    getTaxRate(),
    db.query.trade_trims.findMany(),
  ]);
  const s = computeStats(open, closed, allTrims);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayState = states.find((r) => r.date === todayKey) ?? null;
  const recentStates = [...states].reverse().map((r) => ({ date: r.date, gauge: r.gauge }));

  const pendingPayouts = computePendingPayouts([...open, ...closed], withdrawals, allTrims);
  const todaysPaidOut = withdrawals.filter((w) => w.date === todayKey);
  const todaysWithdrawTotal = todaysPaidOut.reduce((s, w) => s + w.withdraw_amount, 0);
  const todaysKeptTotal = todaysPaidOut.reduce((s, w) => s + w.kept_amount, 0);
  const todaysDayPnlLocked = todaysPaidOut.reduce((s, w) => s + w.day_pnl, 0);
  const pendingTotal = pendingPayouts.reduce((s, p) => s + p.day_pnl, 0);
  const effectiveTotals = computeEffectivePayoutTotals([...open, ...closed], withdrawals);
  const paidOutLifetime = effectiveTotals.paid;
  const keptLifetime = effectiveTotals.kept;

  if (open.length === 0 && closed.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-muted">Log a trade to start building your journal.</p>
        </div>
        <div className="card flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-muted">No trades logged yet.</p>
          <Link href="/new" className="btn btn-primary">
            Log your first trade
          </Link>
        </div>
      </div>
    );
  }

  const maxAbsEmotion = Math.max(1, ...s.pnlByEmotion.map((e) => Math.abs(e.totalPnl)));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="fresh-hidden mt-1 text-sm text-muted">
            {s.daysJournaled} day{s.daysJournaled === 1 ? "" : "s"} journaled · {s.totalClosed} closed · {s.totalOpen} open
          </p>
          <p className="fresh-only mt-1 text-sm text-muted">
            Fresh session. Only today&apos;s activity is visible.
          </p>
        </div>
        {s.currentStreak.type !== "none" && (
          <span className="chip fresh-hidden" data-on="true">
            {s.currentStreak.type === "win" ? "▲" : "▼"} {s.currentStreak.count} {s.currentStreak.type} streak
          </span>
        )}
      </div>

      <SessionScope />

      {/* Fresh Slate only: prominent Today's state + session summary at top */}
      <div className="fresh-only space-y-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
          <TodaySessionCard
            openCount={s.totalOpen}
            closedToday={
              closed.filter((t) => {
                if (!t.closed_at) return false;
                const k = `${t.closed_at.getFullYear()}-${String(t.closed_at.getMonth() + 1).padStart(2, "0")}-${String(t.closed_at.getDate()).padStart(2, "0")}`;
                return k === todayKey;
              }).length +
              allTrims.filter((tr) => {
                const k = `${tr.at.getFullYear()}-${String(tr.at.getMonth() + 1).padStart(2, "0")}-${String(tr.at.getDate()).padStart(2, "0")}`;
                return k === todayKey;
              }).length
            }
          />
          <DailyGauge
            today={todayState ? { gauge: todayState.gauge, note: todayState.note } : null}
            recent={recentStates}
          />
        </div>

        {/* 5 Truths + 7 Principles anchor for the day */}
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="rounded-2xl p-5"
            style={{
              background:
                "linear-gradient(180deg, rgba(147,197,253,0.06), rgba(147,197,253,0.015))",
              border: "1px solid rgba(147,197,253,0.22)",
              boxShadow: "0 0 32px -12px rgba(147,197,253,0.16)",
            }}
          >
            <div
              className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#93C5FD" }}
            >
              5 Fundamental Truths
            </div>
            <ol className="space-y-2 text-sm leading-snug text-text">
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span><span>Anything can happen.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span><span>You don&apos;t need to know what happens next to make money.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span><span>Wins and losses are randomly distributed for any given edge.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span><span>An edge is only a higher probability of one thing over another.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span><span>Every moment in the market is unique.</span></li>
            </ol>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{
              background:
                "linear-gradient(180deg, rgba(147,197,253,0.06), rgba(147,197,253,0.015))",
              border: "1px solid rgba(147,197,253,0.22)",
              boxShadow: "0 0 32px -12px rgba(147,197,253,0.16)",
            }}
          >
            <div
              className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "#93C5FD" }}
            >
              7 Principles of Consistency
            </div>
            <p className="mb-3 text-sm italic text-muted">I am a consistent winner because&hellip;</p>
            <ol className="space-y-2 text-sm leading-snug text-text">
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span><span>I objectively identify my edges.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span><span>I predefine the risk of every trade.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span><span>I completely accept the risk, or let go of the trade.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span><span>I act on my edges without reservation or hesitation.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span><span>I pay myself as the market makes money available to me.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>6.</span><span>I continually monitor my susceptibility for making errors.</span></li>
              <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>7.</span><span>I understand the absolute necessity of these principles — and never violate them.</span></li>
            </ol>
            <div
              className="mt-4 border-t pt-3 text-center italic leading-relaxed text-sm"
              style={{ borderColor: "rgba(147,197,253,0.18)" }}
            >
              I am a consistently profitable trader.
              <br />
              I am a consistently profitable trader.
              <br />
              I am a consistently profitable trader.
              <br />
              I am a professional risk manager.
              <br />
              I am a professional risk manager.
              <br />
              I am a professional risk manager.
            </div>
          </div>
        </div>
      </div>

      {todaysPaidOut.length > 0 && (
        <div
          className="card flex flex-wrap items-center justify-between gap-4 p-4"
          style={{
            background: "linear-gradient(180deg, rgba(74,222,128,0.06), rgba(74,222,128,0.015))",
            border: "1px solid rgba(74,222,128,0.22)",
          }}
        >
          <div>
            <div
              className="text-[0.68rem] font-medium uppercase tracking-wider"
              style={{ color: "#4ADE80" }}
            >
              Today&apos;s payout · locked in
            </div>
            <div className="mt-1 text-sm">
              Paid out{" "}
              <span className="pnl-value font-mono font-semibold tabular-nums" style={{ color: "#4ADE80" }}>
                +${todaysWithdrawTotal.toFixed(2)}
              </span>
              {" · "}
              kept{" "}
              <span className="pnl-value font-mono font-semibold tabular-nums">
                +${todaysKeptTotal.toFixed(2)}
              </span>
              {" · "}
              on{" "}
              <span className="pnl-value font-mono tabular-nums">
                +${todaysDayPnlLocked.toFixed(2)}
              </span>{" "}
              of day P&L
              {todaysPaidOut.length > 1 && (
                <span className="ml-1 text-muted">({todaysPaidOut.length} payouts)</span>
              )}
            </div>
          </div>
          <form action={undoWithdrawal}>
            <input type="hidden" name="date" value={todayKey} />
            <button type="submit" className="btn btn-ghost !py-1.5 !px-3 !text-xs">
              Undo
            </button>
          </form>
        </div>
      )}

      {pendingPayouts.length > 0 && (
        <section id="payouts" className="scroll-mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#4ADE80" }}>
                Payouts pending · 60/40 rule
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {pendingPayouts.length} green day{pendingPayouts.length === 1 ? "" : "s"} · +${pendingTotal.toFixed(2)} untaken.
                Withdraw 60%, roll 40% back into the market.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {pendingPayouts.map((p) => {
              const isToday = p.date === todayKey;
              const w = p.day_pnl * 0.6;
              const k = p.day_pnl * 0.4;
              return (
                <form key={p.date} action={acknowledgeWithdrawal} className={isToday ? "" : "fresh-hidden"}>
                  <input type="hidden" name="date" value={p.date} />
                  <input type="hidden" name="day_pnl" value={p.day_pnl} />
                  <div
                    className="card flex flex-wrap items-center justify-between gap-4 p-4"
                    style={{
                      background: isToday
                        ? "linear-gradient(180deg, rgba(74,222,128,0.14), rgba(74,222,128,0.04))"
                        : "linear-gradient(180deg, rgba(74,222,128,0.07), rgba(74,222,128,0.02))",
                      border: `1px solid rgba(74,222,128,${isToday ? 0.4 : 0.22})`,
                      boxShadow: isToday ? "0 0 28px -10px rgba(74,222,128,0.35)" : "none",
                    }}
                  >
                    <div className="flex items-baseline gap-4">
                      <div>
                        <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                          {isToday ? "Today" : p.date}
                        </div>
                        <div
                          className="pnl-value mt-1 font-mono text-xl font-semibold tabular-nums"
                          style={{ color: "#4ADE80" }}
                        >
                          +${p.day_pnl.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-xs text-muted">
                        <div>
                          Payout <span className="pnl-value font-semibold text-text">${w.toFixed(2)}</span>
                        </div>
                        <div>
                          Keep <span className="pnl-value font-semibold text-text">${k.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Mark paid out
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-8">
          <div className="fresh-hidden grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Realized P&L"
              value={fmtMoney(s.totalPnl)}
              sub={fmtPctOfCost(s.totalPnl, s.totalCostBasis) ?? undefined}
              valueClass={pnlClass(s.totalPnl)}
            />
            <StatCard
              label="Win rate"
              value={fmtPct(s.winRate)}
              sub={`${s.wins}W · ${s.losses}L${s.scratches ? ` · ${s.scratches} scratch` : ""}`}
            />
            <StatCard
              label="Avg / trade"
              value={fmtMoney(s.avgPnl)}
              sub={s.totalClosed > 0 ? (fmtPctOfCost(s.avgPnl, s.totalCostBasis / s.totalClosed) ?? undefined) : undefined}
              valueClass={pnlClass(s.avgPnl)}
            />
            <StatCard
              label="Best · Worst"
              value={fmtMoney(s.bestPnl)}
              sub={`worst ${fmtMoney(s.worstPnl)}`}
              valueClass={pnlClass(s.bestPnl)}
            />
          </div>

          {/* Monthly P&L — same attribution as the daily calendar:
                closed trade's full pnl → opened_at month;
                open trade's trims → trim.at month. */}
          <MonthlyPnL closed={closed} open={open} trims={allTrims} />

          <div className="fresh-hidden">
            <CalendarPnL
              year={year}
              month={month}
              closed={closed}
              allTrades={[...open, ...closed]}
              trims={allTrims}
            />
          </div>

          <div
            className={`fresh-hidden grid gap-4 ${withdrawals.length > 0 ? "md:grid-cols-2" : ""}`}
          >
            <PostTaxCard grossPnl={s.totalPnl} taxRate={taxRate} />
            {withdrawals.length > 0 && (
              <div className="card grid grid-cols-3 gap-4 p-5 text-center">
                <div>
                  <div className="text-xs font-medium text-muted">60/40 · Paid out</div>
                  <div className="pnl-value mt-1 font-mono text-xl font-semibold tabular-nums" style={{ color: "#4ADE80" }}>
                    +${paidOutLifetime.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">Kept in market</div>
                  <div className="pnl-value mt-1 font-mono text-xl font-semibold tabular-nums">
                    +${keptLifetime.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">Green days locked</div>
                  <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {withdrawals.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="fresh-hidden">
          <DailyGauge
            today={todayState ? { gauge: todayState.gauge, note: todayState.note } : null}
            recent={recentStates}
          />
        </div>
      </div>

      {s.pnlByEmotion.length > 0 && (
        <section className="fresh-hidden">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">P&L by pre-trade emotion</h2>
            <p className="mt-1 text-sm text-muted">Which mental state actually makes you money?</p>
          </div>
          <div className="card p-5">
            <div className="space-y-3">
              {s.pnlByEmotion.map((e) => {
                const pct = (Math.abs(e.totalPnl) / maxAbsEmotion) * 100;
                const positive = e.totalPnl >= 0;
                return (
                  <div
                    key={e.emotion}
                    className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-4 text-sm"
                  >
                    <div className="capitalize text-muted">{e.emotion}</div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${positive ? "bg-win" : "bg-loss"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`text-right font-mono tabular-nums ${pnlClass(e.totalPnl)}`}>
                      <span className="pnl-value">{fmtMoney(e.totalPnl)}</span>
                      <div className="text-[0.68rem] text-muted">
                        {e.count} trade{e.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
