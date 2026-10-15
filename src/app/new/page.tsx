import { createTrade } from "./actions";
import { DIRECTIONS, EMOTIONS_BEFORE, SETUP_TYPES, MARKET_REGIMES } from "@/lib/enums";
import { db, schema } from "@/db";
import { and, inArray, isNull } from "drizzle-orm";
import TargetEditor from "../TargetEditor";
import InstrumentAndSize from "../InstrumentAndSize";

export const dynamic = "force-dynamic";

const MAX_OPEN_OPTION_POSITIONS = 5;
const OPTION_INSTRUMENTS = ["call", "put", "call_spread", "put_spread"] as const satisfies readonly (typeof schema.trades.$inferInsert.instrument)[];

export default async function NewTradePage() {
  const openOptionTrades = await db.query.trades.findMany({
    where: and(
      isNull(schema.trades.closed_at),
      inArray(schema.trades.instrument, [...OPTION_INSTRUMENTS]),
    ),
  });
  const openOptionCount = openOptionTrades.length;
  const overLimit = openOptionCount >= MAX_OPEN_OPTION_POSITIONS;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New trade</h1>
        <p className="mt-1 text-sm text-muted">
          Commit to a plan before you click buy. That&apos;s the whole point.
        </p>
      </div>

      {overLimit && (
        <section
          className="rounded-2xl p-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(248,113,113,0.14), rgba(248,113,113,0.04))",
            border: "1.5px solid rgba(248,113,113,0.55)",
            boxShadow: "0 0 42px -14px rgba(248,113,113,0.5)",
          }}
        >
          <div
            className="text-[0.62rem] font-semibold uppercase tracking-[0.28em]"
            style={{ color: "#F87171" }}
          >
            Rule violation — Max open option positions reached
          </div>
          <h2
            className="mt-2 text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            You already have {openOptionCount} open option trades. Your limit is {MAX_OPEN_OPTION_POSITIONS}.
          </h2>
          <div className="mt-3 text-sm leading-relaxed text-text">
            You set this rule in a clear-headed moment. The number sitting in
            front of you right now is bigger than that one. Before you open
            another option position, read these out loud:
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-snug text-text">
            <li className="flex gap-2">
              <span style={{ color: "#F87171" }}>•</span>
              <span>
                <strong>You are overexposed.</strong> One correlated down-move
                can compound across six positions at once. The math stops being
                in your favor when you&apos;re this spread out.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#F87171" }}>•</span>
              <span>
                <strong>Your attention is divided.</strong> The one trade that
                needs you most won&apos;t get managed properly. Trims get missed.
                Stops get ignored. You start reacting instead of executing.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#F87171" }}>•</span>
              <span>
                <strong>&ldquo;This time is different&rdquo; is the thought
                that kills consistent traders.</strong> If you&apos;re here, part
                of you is chasing — FOMO, revenge, euphoria. Name it.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#F87171" }}>•</span>
              <span>
                <strong>Rules only matter if you keep them.</strong> Every
                override makes the next one easier. This is how discipline
                dies — one &ldquo;just this once&rdquo; at a time.
              </span>
            </li>
          </ul>
          <div
            className="mt-4 rounded-lg p-3 text-xs italic"
            style={{
              background: "rgba(27,38,50,0.4)",
              border: "1px solid rgba(248,113,113,0.25)",
            }}
          >
            Better move: close something first, or walk away for 30 minutes and
            see if you still want this trade. The market will be here tomorrow.
          </div>
          <div className="mt-5 border-t border-loss/30 pt-4">
            <div
              className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted"
            >
              Already open ({openOptionCount}):
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {openOptionTrades.map((t) => (
                <span
                  key={t.id}
                  className="font-mono text-xs rounded px-2 py-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  ${t.ticker}
                  {t.strike ? ` ${t.strike}${t.instrument === "put" ? "p" : "c"}` : ""}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <form action={createTrade} className="card space-y-6 p-6">
        {overLimit && (
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1.5px solid rgba(248,113,113,0.45)",
            }}
          >
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="override_max_positions"
                value="1"
                className="mt-1"
              />
              <span>
                <span className="font-semibold" style={{ color: "#F87171" }}>
                  If this is an option trade, I am consciously breaking my
                  {" "}{MAX_OPEN_OPTION_POSITIONS}-option-position rule.
                </span>
                <br />
                <span className="text-xs text-muted">
                  Stock trades don&apos;t count toward the limit — leave this
                  unchecked and submit normally. Only check it to force through
                  another <em>option</em> position. I&apos;ve read the warning
                  above and accept full responsibility.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ticker">Ticker</label>
            <input id="ticker" name="ticker" required placeholder="SPY" autoFocus />
          </div>
          <div>
            <label htmlFor="direction">Direction</label>
            <select id="direction" name="direction" required defaultValue="long">
              {DIRECTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <InstrumentAndSize />
          <div>
            <label htmlFor="planned_entry">Entry (price level)</label>
            <input id="planned_entry" name="planned_entry" type="number" step="any" placeholder="e.g. 648 (stock price)" />
          </div>
          <div>
            <label htmlFor="planned_stop">Stop / invalidation (price level)</label>
            <input id="planned_stop" name="planned_stop" type="number" step="any" placeholder="where I'm wrong" />
          </div>
          <div className="col-span-2">
            <label>Take-profit levels</label>
            <TargetEditor />
          </div>
        </div>

        <div>
          <label htmlFor="thesis">Thesis — why this trade, right now?</label>
          <textarea id="thesis" name="thesis" required rows={4} placeholder="Setup, catalyst, invalidation..." />
        </div>

        {/* ── Setup section ─────────────────────────────── */}
        <div className="rounded-xl border border-border/60 bg-surface/30 p-5 space-y-4">
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
              Setup
            </div>
            <p className="mt-1 text-xs text-muted">
              Tag the setup so you can slice performance by entry type later.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="setup_type">Setup type</label>
              <select id="setup_type" name="setup_type" defaultValue="">
                <option value="">— pick one —</option>
                {SETUP_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="key_level">Key level ($)</label>
              <input id="key_level" name="key_level" type="number" step="any" placeholder="the price this setup is built around" />
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-2">Criteria that hit (check all that apply)</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="check-chip">
                <input type="checkbox" name="criteria_coiling" value="1" />
                <span>Coiling / consolidating</span>
              </label>
              <label className="check-chip">
                <input type="checkbox" name="criteria_resistance" value="1" />
                <span>Resistance at key level</span>
              </label>
              <label className="check-chip">
                <input type="checkbox" name="criteria_support" value="1" />
                <span>Support at key level</span>
              </label>
              <label className="check-chip">
                <input type="checkbox" name="criteria_hh_hl" value="1" />
                <span>Higher highs & higher lows</span>
              </label>
              <label className="check-chip">
                <input type="checkbox" name="criteria_rel_strength" value="1" />
                <span>Relative strength vs market</span>
              </label>
              <label className="check-chip">
                <input type="checkbox" name="criteria_news" value="1" />
                <span>News / catalyst</span>
              </label>
            </div>
          </div>

          <label className="check-chip w-fit">
            <input type="checkbox" name="on_watchlist" value="1" />
            <span>This was on my watchlist (pre-planned)</span>
          </label>

          <div>
            <label htmlFor="market_regime">Market regime (SPX / QQQ)</label>
            <select id="market_regime" name="market_regime" defaultValue="">
              <option value="">— pick one —</option>
              {MARKET_REGIMES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="emotion_before">State going in</label>
            <select id="emotion_before" name="emotion_before" required defaultValue="calm">
              {EMOTIONS_BEFORE.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="conviction">Conviction (1–5)</label>
            <input id="conviction" name="conviction" type="number" min={1} max={5} step={1} required defaultValue={3} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/" className="btn btn-ghost">Cancel</a>
          <button type="submit" className="btn btn-primary">Open trade</button>
        </div>
      </form>
    </div>
  );
}
