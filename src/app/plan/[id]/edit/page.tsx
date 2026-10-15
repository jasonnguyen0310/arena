import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { updateTradeIdea } from "../../actions";
import { SETUP_TYPES, SIZING_TIERS } from "@/lib/enums";
import TargetEditor from "../../../TargetEditor";

export const dynamic = "force-dynamic";

export default async function EditTradeIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ideaId = Number(id);
  if (!Number.isFinite(ideaId)) notFound();

  const idea = await db.query.trade_ideas.findFirst({
    where: eq(schema.trade_ideas.id, ideaId),
  });
  if (!idea) notFound();

  const action = updateTradeIdea.bind(null, ideaId);

  const initialTps: number[] = (() => {
    if (!idea.targets) return [];
    try {
      const parsed = JSON.parse(idea.targets);
      if (Array.isArray(parsed)) return parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    } catch {}
    return [];
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Edit idea
          </div>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            ${idea.ticker} · {idea.planned_date}
          </h1>
        </div>
        <Link href="/plan" className="btn btn-ghost">← Back</Link>
      </div>

      <form action={action} className="card space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[9rem_7rem_1fr]">
          <div>
            <label htmlFor="planned_date" className="text-[0.68rem] uppercase tracking-wider text-muted">Planned date</label>
            <input id="planned_date" name="planned_date" type="date" required defaultValue={idea.planned_date} className="!py-2" />
          </div>
          <div>
            <label htmlFor="ticker" className="text-[0.68rem] uppercase tracking-wider text-muted">Ticker</label>
            <input id="ticker" name="ticker" required defaultValue={idea.ticker} autoComplete="off" className="!py-2" />
          </div>
          <div>
            <label htmlFor="direction" className="text-[0.68rem] uppercase tracking-wider text-muted">Direction</label>
            <select id="direction" name="direction" required defaultValue={idea.direction} className="!py-2">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="trigger_level" className="text-[0.68rem] uppercase tracking-wider text-muted">Trigger (price level)</label>
            <input id="trigger_level" name="trigger_level" type="number" step="any" defaultValue={idea.trigger_level ?? ""} className="!py-2" />
          </div>
          <div>
            <label htmlFor="invalidation" className="text-[0.68rem] uppercase tracking-wider text-muted">Invalidation</label>
            <input id="invalidation" name="invalidation" type="number" step="any" defaultValue={idea.invalidation ?? ""} className="!py-2" />
          </div>
        </div>

        <div>
          <label className="text-[0.68rem] uppercase tracking-wider text-muted">Take-profit levels</label>
          <TargetEditor initial={initialTps} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="setup_type" className="text-[0.68rem] uppercase tracking-wider text-muted">Setup type</label>
            <select id="setup_type" name="setup_type" defaultValue={idea.setup_type ?? ""} className="!py-2">
              <option value="">— pick one —</option>
              {SETUP_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sizing_tier" className="text-[0.68rem] uppercase tracking-wider text-muted">Planned size</label>
            <select id="sizing_tier" name="sizing_tier" defaultValue={idea.sizing_tier ?? ""} className="!py-2">
              <option value="">— pick a tier —</option>
              {SIZING_TIERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} — {s.tier}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="text-[0.68rem] uppercase tracking-wider text-muted">Status</label>
            <select id="status" name="status" defaultValue={idea.status} className="!py-2">
              <option value="planned">Planned</option>
              <option value="executed">Executed</option>
              <option value="passed">Passed</option>
              <option value="invalidated">Invalidated</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="catalyst" className="text-[0.68rem] uppercase tracking-wider text-muted">Catalyst / thesis</label>
          <textarea id="catalyst" name="catalyst" rows={2} defaultValue={idea.catalyst ?? ""} className="!py-2" />
        </div>

        <div>
          <label htmlFor="notes" className="text-[0.68rem] uppercase tracking-wider text-muted">Notes</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={idea.notes ?? ""} className="!py-2" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary !py-2">Save changes</button>
          <Link href="/plan" className="text-[0.72rem] uppercase tracking-wider text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
