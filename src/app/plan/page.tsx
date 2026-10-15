import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { TradeIdea } from "@/db/schema";
import { deleteTradeIdea, updateIdeaStatus, upsertWeeklyPlan } from "./actions";
import { INDICES_BEHAVIOR, SIZING_TIERS } from "@/lib/enums";

export const dynamic = "force-dynamic";

function mondayOf(d: Date): string {
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function parseTargets(json: string | null): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  } catch {}
  return [];
}

function statusStyle(s: string): { bg: string; fg: string; border: string; label: string } {
  switch (s) {
    case "executed":
      return { bg: "rgba(74,222,128,0.10)", fg: "#4ADE80", border: "rgba(74,222,128,0.35)", label: "Executed" };
    case "passed":
      return { bg: "rgba(255,255,255,0.04)", fg: "var(--color-muted)", border: "rgba(255,255,255,0.10)", label: "Passed" };
    case "invalidated":
      return { bg: "rgba(248,113,113,0.10)", fg: "#F87171", border: "rgba(248,113,113,0.35)", label: "Invalidated" };
    default:
      return { bg: "rgba(147,197,253,0.10)", fg: "#93C5FD", border: "rgba(147,197,253,0.35)", label: "Planned" };
  }
}

function indicesLabel(v: string | null): string | null {
  if (!v) return null;
  return INDICES_BEHAVIOR.find((o) => o.value === v)?.label ?? v;
}

function tierLabel(n: number | null): string {
  if (n == null) return "—";
  const t = SIZING_TIERS.find((s) => s.value === n);
  return t ? `${t.label} · ${t.tier}` : `$${n.toLocaleString()}`;
}

export default async function PlanPage() {
  const now = new Date();
  const thisWeek = mondayOf(now);

  const [ideas, weekPlan] = await Promise.all([
    db.query.trade_ideas.findMany({ orderBy: desc(schema.trade_ideas.planned_date) }),
    db.query.weekly_plans.findFirst({ where: eq(schema.weekly_plans.week_start, thisWeek) }),
  ]);

  // Group ideas by planned_date (newest first)
  const byDate = new Map<string, TradeIdea[]>();
  for (const i of ideas) {
    const arr = byDate.get(i.planned_date) ?? [];
    arr.push(i);
    byDate.set(i.planned_date, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Trade Plan
          </div>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            This week&apos;s playbook
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pre-trade intent. Did I follow the plan, or chase?
          </p>
        </div>
        <Link href="/plan/new" className="btn btn-primary">+ New Idea</Link>
      </div>

      {/* Weekly bias — collapsible-ish single card */}
      <section className="card overflow-hidden">
        <div className="border-b border-border/60 px-5 py-3">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Week of {fmtDate(thisWeek)}
          </div>
          <div
            className="mt-1 text-sm font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Top-down bias &amp; macro calendar
          </div>
        </div>
        <form action={upsertWeeklyPlan.bind(null, thisWeek)} className="space-y-3 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {([
              ["spx_bias", "SPX", weekPlan?.spx_bias ?? ""],
              ["qqq_bias", "QQQ", weekPlan?.qqq_bias ?? ""],
              ["smh_bias", "SMH", weekPlan?.smh_bias ?? ""],
            ] as const).map(([name, label, val]) => (
              <div key={name}>
                <label htmlFor={name} className="text-[0.62rem] uppercase tracking-wider text-muted">{label}</label>
                <select id={name} name={name} defaultValue={val ?? ""} className="!py-2">
                  <option value="">— pick one —</option>
                  {INDICES_BEHAVIOR.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="macro_calendar" className="text-[0.62rem] uppercase tracking-wider text-muted">
              Macro calendar
            </label>
            <textarea id="macro_calendar" name="macro_calendar" rows={2} defaultValue={weekPlan?.macro_calendar ?? ""} placeholder="e.g. CPI Wed 8:30am, PPI Thu, Powell speech Fri" className="!py-2" />
          </div>
          <div>
            <label htmlFor="notes" className="text-[0.62rem] uppercase tracking-wider text-muted">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={2} defaultValue={weekPlan?.notes ?? ""} placeholder="What's the big story this week? What am I watching?" className="!py-2" />
          </div>
          <button type="submit" className="btn btn-ghost !py-2 text-xs">Save weekly bias</button>
        </form>
      </section>

      {/* Ideas list grouped by date */}
      {ideas.length === 0 ? (
        <div className="card p-10 text-center text-muted space-y-3">
          <p>No trade ideas logged yet.</p>
          <Link href="/plan/new" className="btn btn-primary inline-block">
            + Log your first idea
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
                {fmtDate(date)}
              </h2>
              <div className="space-y-2">
                {byDate.get(date)!.map((i) => {
                  const sz = statusStyle(i.status);
                  const tps = parseTargets(i.targets);
                  return (
                    <article key={i.id} className="card p-4">
                      <header className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-base font-semibold">${i.ticker}</span>
                          <span
                            className="text-[0.6rem] font-semibold uppercase tracking-wider"
                            style={{ color: i.direction === "long" ? "#4ADE80" : "#F87171" }}
                          >
                            {i.direction}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider"
                            style={{ background: sz.bg, color: sz.fg, border: `1px solid ${sz.border}` }}
                          >
                            {sz.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link href={`/plan/${i.id}/edit`} className="text-[0.68rem] uppercase tracking-wider text-muted hover:text-text">
                            Edit
                          </Link>
                          <form action={deleteTradeIdea.bind(null, i.id)}>
                            <button type="submit" className="text-[0.68rem] text-muted hover:text-loss" aria-label={`Delete ${i.ticker} idea`}>
                              ✕
                            </button>
                          </form>
                        </div>
                      </header>

                      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                        <Field label="Trigger" value={i.trigger_level ?? "—"} />
                        <Field label="Invalidation" value={i.invalidation ?? "—"} />
                        <Field label="Targets" value={tps.length > 0 ? tps.join(" / ") : "—"} />
                        <Field label="Size" value={tierLabel(i.sizing_tier)} />
                      </div>

                      {(i.catalyst || i.setup_type) && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          {i.setup_type && <span className="font-mono">{i.setup_type.replace(/_/g, " ")}</span>}
                          {i.catalyst && <span>· {i.catalyst}</span>}
                        </div>
                      )}

                      {i.notes && (
                        <div className="mt-3 whitespace-pre-wrap text-xs leading-snug text-text">{i.notes}</div>
                      )}

                      {/* Quick status actions */}
                      <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem]">
                        {(["planned", "executed", "passed", "invalidated"] as const).map((s) => (
                          <form key={s} action={updateIdeaStatus.bind(null, i.id, s)}>
                            <button
                              type="submit"
                              disabled={i.status === s}
                              className="rounded-full px-3 py-1 uppercase tracking-wider transition-colors"
                              style={{
                                color: i.status === s ? statusStyle(s).fg : "var(--color-muted)",
                                background: i.status === s ? statusStyle(s).bg : "transparent",
                                border: `1px solid ${i.status === s ? statusStyle(s).border : "var(--color-border)"}`,
                                opacity: i.status === s ? 1 : 0.75,
                                cursor: i.status === s ? "default" : "pointer",
                              }}
                            >
                              {statusStyle(s).label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums">{value}</div>
    </div>
  );
}
