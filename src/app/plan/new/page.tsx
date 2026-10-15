import Link from "next/link";
import { addTradeIdea } from "../actions";
import { SETUP_TYPES, SIZING_TIERS } from "@/lib/enums";
import TargetEditor from "../../TargetEditor";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewTradeIdeaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            New trade idea
          </div>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            Log a plan
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pre-trade intent. Trigger, invalidation, targets — before the open.
          </p>
        </div>
        <Link href="/plan" className="btn btn-ghost">← Back</Link>
      </div>

      <form action={addTradeIdea} className="card space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[9rem_7rem_1fr]">
          <div>
            <label htmlFor="planned_date" className="text-[0.68rem] uppercase tracking-wider text-muted">Planned date</label>
            <input id="planned_date" name="planned_date" type="date" required defaultValue={todayLocal()} className="!py-2" />
          </div>
          <div>
            <label htmlFor="ticker" className="text-[0.68rem] uppercase tracking-wider text-muted">Ticker</label>
            <input id="ticker" name="ticker" required placeholder="e.g. AMD" autoComplete="off" className="!py-2" />
          </div>
          <div>
            <label htmlFor="direction" className="text-[0.68rem] uppercase tracking-wider text-muted">Direction</label>
            <select id="direction" name="direction" required defaultValue="long" className="!py-2">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="trigger_level" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Trigger (price level)
            </label>
            <input id="trigger_level" name="trigger_level" type="number" step="any" placeholder="where I take the position" className="!py-2" />
          </div>
          <div>
            <label htmlFor="invalidation" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Invalidation (where I&apos;m wrong)
            </label>
            <input id="invalidation" name="invalidation" type="number" step="any" placeholder="price that proves me wrong" className="!py-2" />
          </div>
        </div>

        <div>
          <label className="text-[0.68rem] uppercase tracking-wider text-muted">Take-profit levels</label>
          <TargetEditor />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="setup_type" className="text-[0.68rem] uppercase tracking-wider text-muted">Setup type</label>
            <select id="setup_type" name="setup_type" defaultValue="" className="!py-2">
              <option value="">— pick one —</option>
              {SETUP_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sizing_tier" className="text-[0.68rem] uppercase tracking-wider text-muted">Planned size</label>
            <select id="sizing_tier" name="sizing_tier" defaultValue="" className="!py-2">
              <option value="">— pick a tier —</option>
              {SIZING_TIERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} — {s.tier}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="catalyst" className="text-[0.68rem] uppercase tracking-wider text-muted">Catalyst / thesis</label>
          <textarea id="catalyst" name="catalyst" rows={2} placeholder="One sentence: why this, right now?" className="!py-2" />
        </div>

        <div>
          <label htmlFor="notes" className="text-[0.68rem] uppercase tracking-wider text-muted">Notes</label>
          <textarea id="notes" name="notes" rows={2} placeholder="anything else to remember before I pull the trigger" className="!py-2" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary !py-2">Save idea</button>
          <Link href="/plan" className="text-[0.72rem] uppercase tracking-wider text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
