import Link from "next/link";
import { desc, isNull, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Trade, TradeTrim } from "@/db/schema";
import TrimEditor from "../TrimEditor";
import ReopenButton from "../ReopenButton";
import { trimPnl, tradeCostBasis, trimCostBasis, fmtPct, fmtPricePct } from "@/lib/payouts";

type TradeWithTrims = Trade & { trims_list: TradeTrim[] };

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pnlClass(n: number | null | undefined) {
  if (n == null || n === 0) return "text-scratch";
  return n > 0 ? "text-win" : "text-loss";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-sm">{value ?? "—"}</div>
    </div>
  );
}

function TradeDetails({ t }: { t: TradeWithTrims }) {
  const isOpen = t.closed_at == null;
  const trims = t.trims_list;
  return (
    <div className="border-t border-border bg-surface-2/40 px-5 py-5 text-sm">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DetailRow label="Size" value={t.planned_size} />
        <DetailRow label="Strike" value={t.strike ?? "—"} />
        <DetailRow label="Expiration" value={t.expiration ?? "—"} />
        <DetailRow label="Planned entry" value={t.planned_entry ?? "—"} />
        <DetailRow label="Planned stop" value={t.planned_stop ?? "—"} />
        <DetailRow label="Planned target" value={t.planned_target ?? "—"} />
      </div>
      <div className="mt-5">
        <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">Thesis</div>
        <p className="mt-1 whitespace-pre-wrap">{t.thesis}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <DetailRow label="State going in" value={t.emotion_before} />
        <DetailRow label="Conviction" value={`${t.conviction} / 5`} />
      </div>
      {!isOpen && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Debrief
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <DetailRow label="Actual entry" value={t.actual_entry ?? "—"} />
            <DetailRow label="Exit" value={t.exit_price ?? "—"} />
            <DetailRow
              label="Result"
              value={
                <span className={`pnl-value font-mono tabular-nums ${pnlClass(t.pnl)}`}>
                  {fmtMoney(t.pnl)}
                  {(() => {
                    const entry = t.actual_entry ?? t.planned_entry;
                    const p = fmtPricePct(entry, t.exit_price, t.direction);
                    return p ? <span className="ml-1 text-xs font-normal opacity-80">({p})</span> : null;
                  })()}
                </span>
              }
            />
            <DetailRow label="State after" value={t.emotion_after ?? "—"} />
          </div>
          {t.market_context && (
            <div className="mt-4">
              <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                Market did
              </div>
              <p className="mt-1 whitespace-pre-wrap">{t.market_context}</p>
            </div>
          )}
          {trims.length > 0 && (
            <div className="mt-4">
              <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                Trims / partials
              </div>
              <div className="mt-2 space-y-2 text-sm">
                {trims.map((tr) => {
                  const pnlColor =
                    tr.pnl == null || tr.pnl === 0
                      ? undefined
                      : tr.pnl > 0
                      ? "var(--color-win)"
                      : "var(--color-loss)";
                  const trimEntry = t.actual_entry ?? t.planned_entry;
                  const trimPct = fmtPricePct(trimEntry, tr.price, t.direction);
                  return (
                    <div key={tr.id} className="rounded-lg border border-border/60 bg-surface/40 p-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-3">
                          <span className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                            Trim {tr.ordinal}
                          </span>
                          <span className="font-mono tabular-nums">
                            {tr.contracts} × ${tr.price.toFixed(2)}
                          </span>
                        </div>
                        {tr.pnl != null && (
                          <span
                            className="pnl-value font-mono text-sm font-semibold tabular-nums"
                            style={{ color: pnlColor }}
                          >
                            {tr.pnl > 0 ? "+" : tr.pnl < 0 ? "-" : ""}$
                            {Math.abs(tr.pnl).toFixed(2)}
                            {trimPct && (
                              <span className="ml-1 text-[0.68rem] font-normal opacity-80">
                                ({trimPct})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {(tr.why || tr.emotion_after) && (
                        <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                          {tr.why ? (
                            <p className="italic text-muted">&ldquo;{tr.why}&rdquo;</p>
                          ) : <span />}
                          {tr.emotion_after && (
                            <span className="text-[0.68rem] uppercase tracking-wider text-muted">
                              {tr.emotion_after}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {t.trims && (
            <div className="mt-4">
              <div className="text-[0.62rem] font-medium uppercase tracking-wider text-dim">
                Legacy trim note
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs italic text-muted">{t.trims}</p>
            </div>
          )}
          {(t.rules_followed || t.rules_broken) && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {t.rules_followed && (
                <div>
                  <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                    Rules followed
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{t.rules_followed}</p>
                </div>
              )}
              {t.rules_broken && (
                <div>
                  <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                    Rules broken
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{t.rules_broken}</p>
                </div>
              )}
            </div>
          )}
          {t.lesson && (
            <div className="mt-4">
              <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                Lesson
              </div>
              <p className="mt-1 whitespace-pre-wrap">{t.lesson}</p>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <ReopenButton tradeId={t.id} ticker={t.ticker} />
            <Link href={`/trades/${t.id}/edit`} className="btn btn-ghost">
              Edit
            </Link>
          </div>
        </div>
      )}
      {isOpen && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-2 text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            Trims / partials
          </div>
          <TrimEditor
            key={`trims-${t.id}-${trims.map((tr) => tr.id).join(",")}`}
            tradeId={t.id}
            existing={trims.map((tr) => ({ contracts: tr.contracts, price: tr.price, pnl: tr.pnl, why: tr.why, emotion_after: tr.emotion_after }))}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Link href={`/trades/${t.id}/edit`} className="btn btn-ghost">
              Edit
            </Link>
            <Link href={`/trades/${t.id}/close`} className="btn btn-primary">
              Close trade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="chev h-4 w-4 text-muted"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const dynamic = "force-dynamic";

type ViewMode = "all" | "options" | "shares";

function parseView(v: string | undefined): ViewMode {
  return v === "options" || v === "shares" ? v : "all";
}

const OPTION_INSTRUMENTS = new Set(["call", "put", "call_spread", "put_spread"]);
function matchesView(t: Trade, view: ViewMode): boolean {
  if (view === "all") return true;
  if (view === "options") return OPTION_INSTRUMENTS.has(t.instrument);
  if (view === "shares") return t.instrument === "stock";
  return true;
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = parseView(viewParam);

  const [openRaw, closedRaw, allTrims] = await Promise.all([
    db.query.trades.findMany({
      where: isNull(schema.trades.closed_at),
      orderBy: desc(schema.trades.opened_at),
    }),
    db.query.trades.findMany({
      where: isNotNull(schema.trades.closed_at),
      orderBy: desc(schema.trades.closed_at),
    }),
    db.query.trade_trims.findMany(),
  ]);
  const trimsByTrade = new Map<number, TradeTrim[]>();
  for (const tr of allTrims) {
    const arr = trimsByTrade.get(tr.trade_id) ?? [];
    arr.push(tr);
    trimsByTrade.set(tr.trade_id, arr);
  }
  const attachTrims = (t: Trade): TradeWithTrims => ({
    ...t,
    trims_list: (trimsByTrade.get(t.id) ?? []).sort((a, b) => a.ordinal - b.ordinal),
  });
  const open = openRaw.filter((t) => matchesView(t, view)).map(attachTrims);
  const closed = closedRaw.filter((t) => matchesView(t, view)).map(attachTrims);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isClosedToday = (t: TradeWithTrims) => {
    if (!t.closed_at) return false;
    const k = `${t.closed_at.getFullYear()}-${String(t.closed_at.getMonth() + 1).padStart(2, "0")}-${String(t.closed_at.getDate()).padStart(2, "0")}`;
    return k === todayKey;
  };
  const closedToday = closed.filter(isClosedToday).length;
  // Sum of trim P&L per open trade (for the "N trims · +$X" summary line)
  const trimSummaryByTrade = new Map<number, { count: number; pnl: number }>();
  for (const tr of allTrims) {
    const parent =
      openRaw.find((t) => t.id === tr.trade_id) ??
      closedRaw.find((t) => t.id === tr.trade_id);
    if (!parent) continue;
    const v = trimPnl(tr, parent) ?? 0;
    const cur = trimSummaryByTrade.get(tr.trade_id) ?? { count: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += v;
    trimSummaryByTrade.set(tr.trade_id, cur);
  }

  const totalOptions = openRaw.filter((t) => OPTION_INSTRUMENTS.has(t.instrument)).length
    + closedRaw.filter((t) => OPTION_INSTRUMENTS.has(t.instrument)).length;
  const totalShares = openRaw.filter((t) => t.instrument === "stock").length
    + closedRaw.filter((t) => t.instrument === "stock").length;
  const totalAll = openRaw.length + closedRaw.length;

  const TABS: { value: ViewMode; label: string; count: number }[] = [
    { value: "all", label: "All", count: totalAll },
    { value: "options", label: "Options", count: totalOptions },
    { value: "shares", label: "Shares", count: totalShares },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Journal</h1>
        <p className="mt-1 text-sm text-muted">
          Every trade you committed to, in order. Tap a row for details.
        </p>
        <div className="mt-4 flex items-center gap-1 border-b border-border/60 pb-2 text-sm">
          {TABS.map((t) => {
            const active = t.value === view;
            return (
              <Link
                key={t.value}
                href={t.value === "all" ? "/trades" : `/trades?view=${t.value}`}
                className="rounded-md px-3 py-1.5 transition-colors"
                style={{
                  color: active ? "#93C5FD" : "var(--color-muted)",
                  background: active ? "rgba(147,197,253,0.08)" : "transparent",
                  border: active ? "1px solid rgba(147,197,253,0.28)" : "1px solid transparent",
                }}
              >
                {t.label}
                <span className="ml-2 text-[0.68rem] text-dim">{t.count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">
          Open positions ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No open positions.</div>
        ) : (
          <div className="space-y-2">
            {open.map((t) => {
              const trimSum = trimSummaryByTrade.get(t.id);
              return (
                <details key={t.id} className="card card-hover overflow-hidden">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-base font-semibold">{t.ticker}</span>
                      <span className="text-xs text-muted">
                        {t.instrument.replace("_", " ")} · {t.direction}
                        {t.strike != null && ` · ${t.strike}${t.instrument === "call" ? "c" : t.instrument === "put" ? "p" : ""}`}
                        {t.expiration && ` · exp ${t.expiration}`}
                        {" · size "}
                        {t.planned_size}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      {trimSum && (
                        <span
                          className="pnl-value hidden font-mono tabular-nums sm:inline"
                          style={{ color: trimSum.pnl > 0 ? "var(--color-win)" : trimSum.pnl < 0 ? "var(--color-loss)" : undefined }}
                        >
                          {trimSum.count} trim{trimSum.count === 1 ? "" : "s"} · {fmtMoney(trimSum.pnl)}
                        </span>
                      )}
                      <span className="hidden sm:inline">
                        {t.emotion_before} · {t.conviction}/5
                      </span>
                      <span className="hidden sm:inline">
                        {t.opened_at.toLocaleDateString()}
                      </span>
                      <Chevron />
                    </div>
                  </summary>
                  <TradeDetails t={t} />
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">
          <span className="fresh-hidden">Closed ({closed.length})</span>
          <span className="fresh-only">Closed today ({closedToday})</span>
        </h2>
        {closed.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No closed trades yet.</div>
        ) : (
          <div className="space-y-2">
            {closed.map((t) => {
              const trimSum = trimSummaryByTrade.get(t.id);
              const entryForPct = t.actual_entry ?? t.planned_entry;
              const pctStr = fmtPricePct(entryForPct, t.exit_price, t.direction);
              return (
                <details
                  key={t.id}
                  className={`card card-hover overflow-hidden ${isClosedToday(t) ? "" : "fresh-hidden"}`}
                >
                  <summary className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-base font-semibold">{t.ticker}</span>
                      <span className="text-xs text-muted">
                        {t.instrument.replace("_", " ")} · {t.direction}
                        {t.strike != null && ` · ${t.strike}${t.instrument === "call" ? "c" : t.instrument === "put" ? "p" : ""}`}
                        {t.expiration && ` · exp ${t.expiration}`}
                        {trimSum && ` · ${trimSum.count} trim${trimSum.count === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="hidden text-muted sm:inline">
                        {t.emotion_before} → {t.emotion_after ?? "—"}
                      </span>
                      <span className="hidden text-muted sm:inline">
                        {t.closed_at?.toLocaleDateString()}
                      </span>
                      <span className={`pnl-value font-mono text-sm font-semibold tabular-nums ${pnlClass(t.pnl)}`}>
                        {fmtMoney(t.pnl)}
                        {pctStr && (
                          <span className="ml-1 text-[0.68rem] font-normal opacity-80">
                            ({pctStr})
                          </span>
                        )}
                      </span>
                      <Chevron />
                    </div>
                  </summary>
                  <TradeDetails t={t} />
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
