import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { EMOTIONS_AFTER, OUTCOMES, EXIT_STRATEGIES, SETUP_WORKED } from "@/lib/enums";
import { closeTrade } from "./actions";
import TrimEditor from "../../../TrimEditor";

export default async function CloseTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tradeId = Number(id);
  if (!Number.isFinite(tradeId)) notFound();

  const trade = await db.query.trades.findFirst({
    where: eq(schema.trades.id, tradeId),
  });
  if (!trade) notFound();
  if (trade.closed_at) redirect("/trades");

  const existingTrims = await db.query.trade_trims.findMany({
    where: eq(schema.trade_trims.trade_id, tradeId),
  });

  const closeAction = closeTrade.bind(null, tradeId);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Close trade</h1>
        <p className="mt-1 text-sm text-muted">
          Sit with what actually happened. This is where the compounding starts.
        </p>
      </div>

      <div className="card p-5 text-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-mono text-base font-semibold">
            {trade.ticker} · {trade.instrument.replace("_", " ")} · {trade.direction}
          </div>
          <div className="text-xs text-muted">
            Opened {trade.opened_at.toLocaleString()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-muted md:grid-cols-3">
          <div>Size <span className="ml-1 text-text">{trade.planned_size}</span></div>
          <div>Strike <span className="ml-1 text-text">{trade.strike ?? "—"}</span></div>
          <div>Expiration <span className="ml-1 text-text">{trade.expiration ?? "—"}</span></div>
          <div>Entry <span className="ml-1 text-text">{trade.planned_entry ?? "—"}</span></div>
          <div>Stop <span className="ml-1 text-text">{trade.planned_stop ?? "—"}</span></div>
          <div>Target <span className="ml-1 text-text">{trade.planned_target ?? "—"}</span></div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs text-muted">Thesis</div>
          <p className="mt-1 whitespace-pre-wrap">{trade.thesis}</p>
        </div>
        <div className="mt-2 text-xs text-muted">
          State: <span className="text-text">{trade.emotion_before}</span> · Conviction: <span className="text-text">{trade.conviction}/5</span>
        </div>
      </div>

      <form action={closeAction} className="card space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="actual_entry">Actual entry</label>
            <input id="actual_entry" name="actual_entry" type="number" step="any" defaultValue={trade.planned_entry ?? undefined} />
          </div>
          <div>
            <label htmlFor="exit_price">Exit price</label>
            <input id="exit_price" name="exit_price" type="number" step="any" />
          </div>
          <div>
            <label htmlFor="pnl">Realized P&L ($)</label>
            <input id="pnl" name="pnl" type="number" step="any" required placeholder="+250 or -180" />
          </div>
          <div>
            <label htmlFor="outcome">Outcome</label>
            <select id="outcome" name="outcome" required defaultValue="win">
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="emotion_after">State after</label>
            <select id="emotion_after" name="emotion_after" required defaultValue="calm">
              {EMOTIONS_AFTER.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── How it played out ──────────────────────── */}
        <div className="rounded-xl border border-border/60 bg-surface/30 p-5 space-y-4">
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
              How it played out
            </div>
            <p className="mt-1 text-xs text-muted">
              Tag the outcome so you can see which setups actually work for you.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="exit_strategy">Exit strategy</label>
              <select id="exit_strategy" name="exit_strategy" defaultValue="">
                <option value="">— pick one —</option>
                {EXIT_STRATEGIES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="setup_worked">Did the setup work?</label>
              <select id="setup_worked" name="setup_worked" defaultValue="">
                <option value="">— pick one —</option>
                {SETUP_WORKED.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="market_context">What did the market do?</label>
          <textarea id="market_context" name="market_context" rows={2} placeholder="SPY reclaimed VWAP, gap fill, chop..." />
        </div>

        <div>
          <label>Trims / partials</label>
          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <TrimEditor
              key={`trims-${tradeId}-${existingTrims.map((t) => t.id).join(",")}`}
              tradeId={tradeId}
              existing={existingTrims
                .sort((a, b) => a.ordinal - b.ordinal)
                .map((t) => ({ contracts: t.contracts, price: t.price, pnl: t.pnl, why: t.why, emotion_after: t.emotion_after, at: t.at }))}
            />
          </div>
          <p className="mt-2 text-[0.68rem] text-dim">
            Trims save independently; the close form saves the rest.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="rules_followed">Rules I followed</label>
            <textarea id="rules_followed" name="rules_followed" rows={3} />
          </div>
          <div>
            <label htmlFor="rules_broken">Rules I broke</label>
            <textarea id="rules_broken" name="rules_broken" rows={3} />
          </div>
        </div>

        <div>
          <label htmlFor="lesson">Lesson — one sentence.</label>
          <textarea id="lesson" name="lesson" rows={2} placeholder="What will I do differently next time?" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/trades" className="btn btn-ghost">Cancel</a>
          <button type="submit" className="btn btn-primary">Close trade</button>
        </div>
      </form>
    </div>
  );
}
