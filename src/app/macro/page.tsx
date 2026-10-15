import Link from "next/link";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import type { MacroEvent } from "@/db/schema";
import { deleteMacroEvent } from "./actions";
import { INDICES_BEHAVIOR } from "@/lib/enums";

export const dynamic = "force-dynamic";

function indicesLabel(v: string | null): string | null {
  if (!v) return null;
  return INDICES_BEHAVIOR.find((o) => o.value === v)?.label ?? v;
}

function surpriseStyle(s: string | null): { bg: string; fg: string; border: string; label: string } {
  switch (s) {
    case "hot":
      return { bg: "rgba(248,113,113,0.10)", fg: "#F87171", border: "rgba(248,113,113,0.35)", label: "Hot" };
    case "cold":
      return { bg: "rgba(147,197,253,0.10)", fg: "#93C5FD", border: "rgba(147,197,253,0.35)", label: "Cold" };
    case "in_line":
      return { bg: "rgba(255,255,255,0.05)", fg: "var(--color-muted)", border: "rgba(255,255,255,0.10)", label: "In-line" };
    default:
      return { bg: "transparent", fg: "var(--color-muted)", border: "transparent", label: "—" };
  }
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function MacroPage() {
  const events: MacroEvent[] = await db.query.macro_events.findMany({
    orderBy: desc(schema.macro_events.event_date),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Macro Journal
          </div>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            CPI · PPI · FOMC
          </h1>
          <p className="mt-1 text-sm text-muted">
            Journal expectations, actuals, and how the tape moved into and out of each print.
          </p>
        </div>
        <Link href="/macro/new" className="btn btn-primary">
          + New Macro Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card p-10 text-center text-muted space-y-3">
          <p>No macro events logged yet.</p>
          <Link href="/macro/new" className="btn btn-primary inline-block">
            + Log your first release
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((e) => {
            const sz = surpriseStyle(e.surprise);
            return (
              <article key={e.id} className="card overflow-hidden">
                <header className="flex items-baseline justify-between gap-3 border-b border-border/60 px-5 py-3">
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-mono text-[0.68rem] font-semibold tabular-nums uppercase tracking-wider"
                      style={{ color: "#93C5FD" }}
                    >
                      {e.event_type}
                    </span>
                    <span
                      className="text-sm font-semibold tracking-tight"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {fmtDate(e.event_date)}
                    </span>
                    {e.surprise && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider"
                        style={{ background: sz.bg, color: sz.fg, border: `1px solid ${sz.border}` }}
                      >
                        {sz.label}
                      </span>
                    )}
                    {([
                      ["SPX", e.spx_behavior_before, e.spx_behavior_after, e.spx_behavior],
                      ["QQQ", e.qqq_behavior_before, e.qqq_behavior_after, e.qqq_behavior],
                      ["SMH", e.smh_behavior_before, e.smh_behavior_after, e.smh_behavior],
                    ] as const)
                      .map(([label, before, after, legacy]) => {
                        const effBefore = before ?? legacy;
                        if (!effBefore && !after) return null;
                        return (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider"
                            style={{
                              background: "rgba(147,197,253,0.08)",
                              color: "#93C5FD",
                              border: "1px solid rgba(147,197,253,0.25)",
                            }}
                          >
                            <span>{label}</span>
                            <span className="opacity-60">·</span>
                            <span>{effBefore ? indicesLabel(effBefore) : "—"}</span>
                            <span className="opacity-60">→</span>
                            <span>{after ? indicesLabel(after) : "—"}</span>
                          </span>
                        );
                      })}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/macro/${e.id}/edit`}
                      className="text-[0.68rem] uppercase tracking-wider text-muted hover:text-text"
                    >
                      Edit
                    </Link>
                    <form action={deleteMacroEvent.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="text-[0.68rem] text-muted hover:text-loss"
                        aria-label={`Delete ${e.event_type} ${e.event_date}`}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </header>
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 md:grid-cols-2">
                  {e.expectations && (
                    <Field label="Expectations" body={e.expectations} />
                  )}
                  {e.actual && <Field label="Actual" body={e.actual} />}
                  {e.days_before && (
                    <Field label="Days before — into the print" body={e.days_before} />
                  )}
                  {e.days_after && (
                    <Field label="Days after — reaction" body={e.days_after} />
                  )}
                  {e.notes && (
                    <div className="md:col-span-2">
                      <Field label="Notes" body={e.notes} />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-snug">{body}</div>
    </div>
  );
}
