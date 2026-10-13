"use client";

import { useMemo, useState } from "react";
import {
  bs,
  daysUntil,
  impliedVol,
  probFinishBeyond,
  probTouchBarrier,
  type OptionKind,
} from "@/lib/blackScholes";

const RATE = 0.04;

function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Returns YYYY-MM-DD for the next Friday (today if today is Friday). */
function nextFriday(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun...5=Fri...6=Sat
  const daysAhead = (5 - dow + 7) % 7; // 0..6, Friday
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Next business day (Mon–Fri) — tomorrow, but Monday if that lands on Sat/Sun. */
function nextBusinessDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dow = d.getDay();
  if (dow === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  else if (dow === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  return d.toISOString().slice(0, 10);
}

function heatColor(cellPct: number): string {
  const cap = Math.max(-1, Math.min(5, cellPct));
  if (cap >= 0) {
    const alpha = Math.min(0.45, 0.05 + cap * 0.08);
    return `rgba(74, 222, 128, ${alpha})`;
  }
  const alpha = Math.min(0.45, 0.05 + Math.abs(cap) * 0.4);
  return `rgba(248, 113, 113, ${alpha})`;
}

export default function OptionsLab() {
  const [ticker, setTicker] = useState("SNDK");
  const [kind, setKind] = useState<OptionKind>("call");
  const [strike, setStrike] = useState<string>("1800");
  const [expiration, setExpiration] = useState<string>(() => nextFriday());
  const [spot, setSpot] = useState<string>("1764");
  const [currentPremium, setCurrentPremium] = useState<string>("27");
  const [targetSpot, setTargetSpot] = useState<string>("1814");
  const [targetDate, setTargetDate] = useState<string>(() => nextBusinessDay());

  const K = Number(strike) || 0;
  const S = Number(spot) || 0;
  const priceNow = Number(currentPremium) || 0;
  const targetS = Number(targetSpot) || 0;
  const dteNow = daysUntil(expiration);
  const dteAtTarget = daysUntil(expiration, new Date(`${targetDate}T14:00:00`));

  // Back-solve implied volatility from the current premium
  const iv = useMemo(() => {
    if (S <= 0 || K <= 0 || priceNow <= 0 || dteNow <= 0) return null;
    return impliedVol(priceNow, S, K, dteNow / 365, RATE, kind);
  }, [S, K, priceNow, dteNow, kind]);

  const priceAtTarget = useMemo(() => {
    if (iv == null || targetS <= 0) return null;
    return bs(targetS, K, dteAtTarget / 365, RATE, iv, kind).price;
  }, [iv, targetS, K, dteAtTarget, kind]);

  const priceAtTargetIvPop = useMemo(() => {
    if (iv == null || targetS <= 0) return null;
    return bs(targetS, K, dteAtTarget / 365, RATE, iv + 0.2, kind).price;
  }, [iv, targetS, K, dteAtTarget, kind]);

  const priceAtTargetIvDrop = useMemo(() => {
    if (iv == null || targetS <= 0) return null;
    return bs(targetS, K, dteAtTarget / 365, RATE, Math.max(0.05, iv - 0.2), kind).price;
  }, [iv, targetS, K, dteAtTarget, kind]);

  // Probability the trade "plays out" — two related numbers.
  const probTouch = useMemo(() => {
    if (iv == null || targetS <= 0 || dteAtTarget <= 0) return null;
    return probTouchBarrier(S, targetS, dteAtTarget / 365, RATE, iv);
  }, [iv, S, targetS, dteAtTarget]);

  const probFinish = useMemo(() => {
    if (iv == null || targetS <= 0 || dteAtTarget <= 0) return null;
    return probFinishBeyond(S, targetS, dteAtTarget / 365, RATE, iv, kind);
  }, [iv, S, targetS, dteAtTarget, kind]);

  // Grid: rows = spot prices, cols = dates. Uses IV held flat.
  const spotSteps = useMemo(() => {
    if (S <= 0) return [];
    const step = S * 0.02;
    const arr: number[] = [];
    for (let i = -3; i <= 4; i++) arr.push(+(S + step * i).toFixed(2));
    return arr;
  }, [S]);

  const dteSteps = useMemo(() => {
    if (dteNow <= 0) return [];
    const steps = 5;
    const arr: number[] = [];
    for (let i = 0; i < steps; i++) arr.push(Math.max(0, dteNow - (dteNow * i) / (steps - 1)));
    return arr;
  }, [dteNow]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
          Options Lab
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          What will my option be worth?
        </h1>
        <p className="mt-2 text-sm text-muted">
          Fill in the contract, its current premium (from your broker chain), and what you think the stock will hit.
          Everything below is text — no sliders.
        </p>
      </div>

      {/* Step 1 — Contract */}
      <section className="card p-5">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            1
          </span>
          <span className="text-sm font-medium">Contract details</span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Ticker</span>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="SNDK"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Call or Put</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as OptionKind)} className="input">
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Strike</span>
            <input
              type="number"
              inputMode="decimal"
              value={strike}
              onChange={(e) => setStrike(e.target.value)}
              className="input font-mono"
              placeholder="1800"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Expiration date</span>
            <input
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="input font-mono"
            />
          </label>
        </div>
        <div className="mt-3 text-[0.65rem] text-dim">
          {dteNow > 0 ? `${dteNow.toFixed(1)} days to expiration` : "Expired"}
        </div>
      </section>

      {/* Step 2 — Right now */}
      <section className="card p-5">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            2
          </span>
          <span className="text-sm font-medium">What&apos;s it worth right now?</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Current stock price</span>
            <input
              type="number"
              inputMode="decimal"
              value={spot}
              onChange={(e) => setSpot(e.target.value)}
              className="input font-mono text-lg"
              placeholder="1764"
            />
            <span className="text-[0.65rem] text-dim">from your broker or Google</span>
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Current option price (mid)</span>
            <input
              type="number"
              inputMode="decimal"
              value={currentPremium}
              onChange={(e) => setCurrentPremium(e.target.value)}
              className="input font-mono text-lg"
              placeholder="27"
            />
            <span className="text-[0.65rem] text-dim">
              from your chain — the {strike}
              {kind === "call" ? "c" : "p"} row
            </span>
          </label>
        </div>
        {iv != null ? (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-border/50 bg-surface/40 px-4 py-3 text-xs">
            <span className="text-muted">Implied volatility for this strike:</span>
            <span className="font-mono text-base font-semibold text-text">{fmt(iv * 100, 1)}%</span>
            <span className="text-dim">back-solved from the premium you entered</span>
          </div>
        ) : priceNow > 0 ? (
          <div className="mt-4 rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-xs text-loss">
            Can&apos;t solve IV — the premium is below intrinsic value, or the contract has expired.
          </div>
        ) : null}
      </section>

      {/* Step 3 — Target */}
      <section className="card p-5">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            3
          </span>
          <span className="text-sm font-medium">What if the stock hits…</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Target stock price</span>
            <input
              type="number"
              inputMode="decimal"
              value={targetSpot}
              onChange={(e) => setTargetSpot(e.target.value)}
              className="input font-mono text-lg"
              placeholder="1814"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">By what date?</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input font-mono text-lg"
            />
            <span className="text-[0.65rem] text-dim">{dteAtTarget.toFixed(1)} days until expiration on that date</span>
          </label>
        </div>
        {dteAtTarget < 0.1 && dteNow > 0 && (
          <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-xs text-muted">
            Your target date is the same as expiration — at that moment there&apos;s no time value left, so the option is worth only its intrinsic value ({kind === "call" ? "max(spot − strike, 0)" : "max(strike − spot, 0)"}). If you want to see what it&apos;s worth <em>before</em> expiration, set the target date earlier.
          </div>
        )}
      </section>

      {/* Probability card */}
      {probTouch != null && probFinish != null && (
        <section className="grid gap-4 md:grid-cols-2">
          <div
            className="card p-6"
            style={{
              background: "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
              border: "1px solid rgba(147,197,253,0.28)",
            }}
          >
            <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
              Prob. of touching ${fmt(targetS, 0)} before {new Date(targetDate + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
            <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: "#93C5FD" }}>
              {fmt(probTouch * 100, 1)}%
            </div>
            <div className="mt-2 text-xs text-muted">
              The stock hits ${fmt(targetS, 0)} at some point — could be brief, then reverse.
            </div>
          </div>
          <div className="card p-6">
            <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
              Prob. of finishing {kind === "call" ? "above" : "below"} ${fmt(targetS, 0)} on that date
            </div>
            <div className="mt-2 font-mono text-4xl font-bold tabular-nums text-text">
              {fmt(probFinish * 100, 1)}%
            </div>
            <div className="mt-2 text-xs text-muted">
              The stock closes {kind === "call" ? "at or above" : "at or below"} ${fmt(targetS, 0)} on {new Date(targetDate + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}.
            </div>
          </div>
        </section>
      )}

      {/* Result */}
      {priceAtTarget != null && iv != null && (
        <section>
          <div className="grid gap-4 md:grid-cols-3">
            <div
              className="card p-6"
              style={{
                background: "linear-gradient(180deg, rgba(74,222,128,0.10), rgba(74,222,128,0.02))",
                border: "1px solid rgba(74,222,128,0.35)",
              }}
            >
              <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                If IV stays flat
              </div>
              <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: "var(--color-win)" }}>
                ${fmt(priceAtTarget)}
              </div>
              <div className="mt-2 text-xs text-muted">
                {priceNow > 0 && (
                  <>
                    <span className="font-mono">
                      {priceAtTarget > priceNow ? "+" : ""}
                      {fmt(((priceAtTarget - priceNow) / priceNow) * 100, 1)}%
                    </span>{" "}
                    return on contract ·{" "}
                    <span className="font-mono">
                      {priceAtTarget > priceNow ? "+" : ""}${fmt(priceAtTarget - priceNow)}
                    </span>{" "}
                    per contract
                  </>
                )}
              </div>
              <div className="mt-3 text-[0.65rem] text-dim">IV held at {fmt(iv * 100, 1)}%</div>
            </div>

            {priceAtTargetIvPop != null && (
              <div className="card p-6">
                <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                  If IV pops +20 pts
                </div>
                <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: "var(--color-win)" }}>
                  ${fmt(priceAtTargetIvPop)}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {priceNow > 0 && (
                    <>
                      <span className="font-mono">
                        {priceAtTargetIvPop > priceNow ? "+" : ""}
                        {fmt(((priceAtTargetIvPop - priceNow) / priceNow) * 100, 1)}%
                      </span>{" "}
                      return on contract
                    </>
                  )}
                </div>
                <div className="mt-3 text-[0.65rem] text-dim">
                  IV at {fmt((iv + 0.2) * 100, 1)}% (typical on a fast rip)
                </div>
              </div>
            )}

            {priceAtTargetIvDrop != null && (
              <div className="card p-6">
                <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                  If IV bleeds −20 pts
                </div>
                <div className="mt-2 font-mono text-4xl font-bold tabular-nums" style={{ color: "var(--color-loss)" }}>
                  ${fmt(priceAtTargetIvDrop)}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {priceNow > 0 && (
                    <>
                      <span className="font-mono">
                        {priceAtTargetIvDrop > priceNow ? "+" : ""}
                        {fmt(((priceAtTargetIvDrop - priceNow) / priceNow) * 100, 1)}%
                      </span>{" "}
                      return on contract
                    </>
                  )}
                </div>
                <div className="mt-3 text-[0.65rem] text-dim">
                  IV at {fmt(Math.max(5, (iv - 0.2) * 100), 1)}% (grinding move)
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Grid — deep view */}
      {iv != null && spotSteps.length > 0 && dteSteps.length > 0 && (
        <section>
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
            Grid · every spot × every date (IV held flat)
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface/40 text-[0.62rem] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">If spot hits</th>
                  {dteSteps.map((t, i) => (
                    <th key={i} className="px-3 py-2 text-right">
                      {t < 0.05 ? "expiry" : `${t.toFixed(1)}d left`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {spotSteps.map((s) => (
                  <tr key={s}>
                    <td className="px-3 py-2 font-mono tabular-nums">${fmt(s)}</td>
                    {dteSteps.map((t, i) => {
                      const p = bs(s, K, t / 365, RATE, iv, kind).price;
                      const change = priceNow > 0 ? (p - priceNow) / priceNow : 0;
                      return (
                        <td
                          key={i}
                          className="px-3 py-2 text-right font-mono tabular-nums"
                          style={{ backgroundColor: heatColor(change) }}
                        >
                          ${fmt(p)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[0.65rem] text-dim">
            Rows: stock price in 2% steps. Columns: time remaining, counting down to expiration.
            Green = higher than what you paid, red = lower.
          </div>
        </section>
      )}
    </div>
  );
}
