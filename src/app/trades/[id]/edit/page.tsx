import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { INSTRUMENTS, DIRECTIONS, EMOTIONS_BEFORE, EMOTIONS_AFTER, OUTCOMES, SETUP_TYPES, EXIT_STRATEGIES, SETUP_WORKED, MARKET_REGIMES, SIZING_TIERS } from "@/lib/enums";
import { updateTrade } from "./actions";
import TrimEditor from "../../../TrimEditor";
import ReopenButton from "../../../ReopenButton";
import TargetEditor from "../../../TargetEditor";
import ScreenshotSection from "../../../ScreenshotSection";
import { desc } from "drizzle-orm";

export default async function EditTradePage({
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

  const existingTrims = await db.query.trade_trims.findMany({
    where: eq(schema.trade_trims.trade_id, tradeId),
  });
  const existingShots = await db.query.trade_screenshots.findMany({
    where: eq(schema.trade_screenshots.trade_id, tradeId),
    orderBy: desc(schema.trade_screenshots.created_at),
  });

  const action = updateTrade.bind(null, tradeId);
  const isClosed = trade.closed_at != null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit trade</h1>
        <p className="mt-1 text-sm text-muted">
          Fix a typo, update a number, refine the lesson. History stays intact.
        </p>
      </div>

      <form action={action} className="card space-y-6 p-6">
        <div>
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Plan</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ticker">Ticker</label>
              <input id="ticker" name="ticker" required defaultValue={trade.ticker} />
            </div>
            <div>
              <label htmlFor="instrument">Instrument</label>
              <select id="instrument" name="instrument" required defaultValue={trade.instrument}>
                {INSTRUMENTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="direction">Direction</label>
              <select id="direction" name="direction" required defaultValue={trade.direction}>
                {DIRECTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="planned_size">Planned size ($)</label>
              {SIZING_TIERS.some((s) => s.value === trade.planned_size) ? (
                <select id="planned_size" name="planned_size" required defaultValue={trade.planned_size}>
                  {SIZING_TIERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} — {s.tier}
                    </option>
                  ))}
                </select>
              ) : (
                // Trade predates the tier dropdown — keep raw number input so
                // historical sizes aren't forced into a tier bucket.
                <input id="planned_size" name="planned_size" type="number" step="any" required defaultValue={trade.planned_size} />
              )}
            </div>
            <div>
              <label htmlFor="strike">Strike (options)</label>
              <input id="strike" name="strike" type="number" step="any" defaultValue={trade.strike ?? ""} />
            </div>
            <div>
              <label htmlFor="expiration">Expiration (options)</label>
              <input id="expiration" name="expiration" type="date" defaultValue={trade.expiration ?? ""} />
            </div>
            <div>
              <label htmlFor="planned_entry">Entry (price level)</label>
              <input id="planned_entry" name="planned_entry" type="number" step="any" defaultValue={trade.planned_entry ?? ""} />
            </div>
            <div>
              <label htmlFor="planned_stop">Stop / invalidation (price level)</label>
              <input id="planned_stop" name="planned_stop" type="number" step="any" defaultValue={trade.planned_stop ?? ""} />
            </div>
            <div className="col-span-2">
              <label>Take-profit levels</label>
              <TargetEditor
                initial={(() => {
                  // Prefer the JSON array; fall back to the numbered columns
                  // for trades saved before planned_targets existed.
                  try {
                    if (trade.planned_targets) {
                      const parsed = JSON.parse(trade.planned_targets);
                      if (Array.isArray(parsed)) {
                        return parsed
                          .map((v) => Number(v))
                          .filter((n) => Number.isFinite(n) && n > 0);
                      }
                    }
                  } catch {}
                  return [trade.planned_target, trade.planned_target_2, trade.planned_target_3]
                    .map((v) => (v == null ? null : Number(v)))
                    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
                })()}
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="thesis">Thesis</label>
            <textarea id="thesis" name="thesis" required rows={4} defaultValue={trade.thesis} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="emotion_before">State going in</label>
              <select id="emotion_before" name="emotion_before" required defaultValue={trade.emotion_before}>
                {EMOTIONS_BEFORE.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="conviction">Conviction (1–5)</label>
              <input id="conviction" name="conviction" type="number" min={1} max={5} step={1} required defaultValue={trade.conviction} />
            </div>
          </div>

          {/* Setup section (backfill on any trade) */}
          <div className="mt-6 rounded-xl border border-border/60 bg-surface/30 p-5 space-y-4">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">Setup</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="setup_type">Setup type</label>
                <select id="setup_type" name="setup_type" defaultValue={trade.setup_type ?? ""}>
                  <option value="">— pick one —</option>
                  {SETUP_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="key_level">Key level ($)</label>
                <input id="key_level" name="key_level" type="number" step="any" defaultValue={trade.key_level ?? ""} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-2">Criteria that hit</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="check-chip">
                  <input type="checkbox" name="criteria_coiling" value="1" defaultChecked={trade.criteria_coiling === 1} />
                  <span>Coiling</span>
                </label>
                <label className="check-chip">
                  <input type="checkbox" name="criteria_resistance" value="1" defaultChecked={trade.criteria_resistance === 1} />
                  <span>Resistance at key level</span>
                </label>
                <label className="check-chip">
                  <input type="checkbox" name="criteria_support" value="1" defaultChecked={trade.criteria_support === 1} />
                  <span>Support at key level</span>
                </label>
                <label className="check-chip">
                  <input type="checkbox" name="criteria_hh_hl" value="1" defaultChecked={trade.criteria_hh_hl === 1} />
                  <span>Higher highs & lows</span>
                </label>
                <label className="check-chip">
                  <input type="checkbox" name="criteria_rel_strength" value="1" defaultChecked={trade.criteria_rel_strength === 1} />
                  <span>Relative strength</span>
                </label>
                <label className="check-chip">
                  <input type="checkbox" name="criteria_news" value="1" defaultChecked={trade.criteria_news === 1} />
                  <span>News / catalyst</span>
                </label>
              </div>
            </div>
            <label className="check-chip w-fit">
              <input type="checkbox" name="on_watchlist" value="1" defaultChecked={trade.on_watchlist === 1} />
              <span>On my watchlist (pre-planned)</span>
            </label>
            <div>
              <label htmlFor="market_regime">Market regime (SPX / QQQ)</label>
              <select id="market_regime" name="market_regime" defaultValue={trade.market_regime ?? ""}>
                <option value="">— pick one —</option>
                {MARKET_REGIMES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isClosed && (
          <div className="border-t border-border pt-6">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Debrief</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="actual_entry">Actual entry</label>
                <input id="actual_entry" name="actual_entry" type="number" step="any" defaultValue={trade.actual_entry ?? ""} />
              </div>
              <div>
                <label htmlFor="exit_price">Exit price</label>
                <input id="exit_price" name="exit_price" type="number" step="any" defaultValue={trade.exit_price ?? ""} />
              </div>
              <div>
                <label htmlFor="pnl">Realized P&L ($)</label>
                <input id="pnl" name="pnl" type="number" step="any" defaultValue={trade.pnl ?? ""} />
              </div>
              <div>
                <label htmlFor="outcome">Outcome</label>
                <select id="outcome" name="outcome" defaultValue={trade.outcome ?? "win"}>
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="emotion_after">State after</label>
                <select id="emotion_after" name="emotion_after" defaultValue={trade.emotion_after ?? "calm"}>
                  {EMOTIONS_AFTER.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* How it played out */}
            <div className="mt-6 rounded-xl border border-border/60 bg-surface/30 p-5 space-y-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">How it played out</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exit_strategy">Exit strategy</label>
                  <select id="exit_strategy" name="exit_strategy" defaultValue={trade.exit_strategy ?? ""}>
                    <option value="">— pick one —</option>
                    {EXIT_STRATEGIES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="setup_worked">Did the setup work?</label>
                  <select id="setup_worked" name="setup_worked" defaultValue={trade.setup_worked ?? ""}>
                    <option value="">— pick one —</option>
                    {SETUP_WORKED.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="market_context">What did the market do?</label>
              <textarea id="market_context" name="market_context" rows={2} defaultValue={trade.market_context ?? ""} />
            </div>
            <div className="mt-4">
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
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rules_followed">Rules I followed</label>
                <textarea id="rules_followed" name="rules_followed" rows={3} defaultValue={trade.rules_followed ?? ""} />
              </div>
              <div>
                <label htmlFor="rules_broken">Rules I broke</label>
                <textarea id="rules_broken" name="rules_broken" rows={3} defaultValue={trade.rules_broken ?? ""} />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="lesson">Lesson</label>
              <textarea id="lesson" name="lesson" rows={2} defaultValue={trade.lesson ?? ""} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <a href="/trades" className="btn btn-ghost">Cancel</a>
          <button type="submit" className="btn btn-primary">Save changes</button>
        </div>
      </form>

      <ScreenshotSection tradeId={tradeId} shots={existingShots} />

      {isClosed && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
          <div>
            <div className="text-sm font-semibold">Reopen this trade</div>
            <p className="mt-1 text-xs text-muted">
              Clears the close timestamp only — debrief and trims stay. Stats and payouts that counted this trade will regenerate.
            </p>
          </div>
          <ReopenButton tradeId={tradeId} ticker={trade.ticker} />
        </div>
      )}
    </div>
  );
}
