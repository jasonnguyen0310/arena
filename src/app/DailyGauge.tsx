"use client";

import { useState } from "react";
import { setDailyState } from "./state-actions";

const GAUGE_LABELS: Record<number, string> = {
  [-3]: "Paralyzed",
  [-2]: "Fearful",
  [-1]: "Cautious",
  0: "Zone",
  1: "Confident",
  2: "Overconfident",
  3: "Euphoric",
};

const GAUGE_HINTS: Record<number, string> = {
  [-3]: "hesitating, can't pull the trigger",
  [-2]: "moving stops, cutting winners early",
  [-1]: "second-guessing setups",
  0: "probabilistic, unattached, executing the plan",
  1: "sharp, following rules, sizing normally",
  2: "seeing setups that aren't there, tempted to size up",
  3: "revenge / FOMO, ignoring rules",
};

function gaugeColor(g: number) {
  const abs = Math.abs(g);
  if (abs === 0) return "#4ADE80";
  if (abs === 1) return "#FACC15";
  if (abs === 2) return "#FB923C";
  return "#F87171";
}

export default function DailyGauge({
  today,
  recent,
}: {
  today: { gauge: number; note: string | null } | null;
  recent: { date: string; gauge: number }[];
}) {
  const [mode, setMode] = useState<"compact" | "edit">(today ? "compact" : "edit");
  const [cur, setCur] = useState<number>(today?.gauge ?? 0);
  const values = [3, 2, 1, 0, -1, -2, -3];
  const curLabel = GAUGE_LABELS[cur];
  const curHint = GAUGE_HINTS[cur];
  const curColor = gaugeColor(cur);

  return (
    <section className="lg:sticky lg:top-6">
      <div className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s state</h2>
          {mode === "compact" && today && (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="text-[0.62rem] uppercase tracking-wider text-muted hover:text-text"
            >
              Edit
            </button>
          )}
          {mode === "edit" && today && (
            <button
              type="button"
              onClick={() => {
                setCur(today.gauge);
                setMode("compact");
              }}
              className="text-[0.62rem] uppercase tracking-wider text-muted hover:text-text"
            >
              Cancel
            </button>
          )}
        </div>

        {mode === "compact" && today ? (
          <>
            <div
              className="rounded-lg p-4"
              style={{
                background: `${curColor}12`,
                border: `1px solid ${curColor}44`,
              }}
            >
              <div
                className="font-mono text-2xl font-semibold tabular-nums leading-none"
                style={{ color: curColor }}
              >
                {cur > 0 ? `+${cur}` : cur} · {curLabel}
              </div>
              <p className="mt-2 text-[0.72rem] leading-snug text-muted">{curHint}</p>
              {today.note && (
                <p className="mt-3 border-t border-white/10 pt-2 text-xs italic text-muted">
                  &ldquo;{today.note}&rdquo;
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className="mb-4 rounded-lg p-3"
              style={{
                background: `${curColor}12`,
                border: `1px solid ${curColor}44`,
              }}
            >
              <div
                className="font-mono text-lg font-semibold tabular-nums leading-none"
                style={{ color: curColor }}
              >
                {cur > 0 ? `+${cur}` : cur} · {curLabel}
              </div>
              <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">{curHint}</p>
            </div>

            <form action={setDailyState} className="space-y-3">
              <div className="space-y-1">
                {values.map((v) => {
                  const color = gaugeColor(v);
                  const isSelected = v === cur;
                  return (
                    <label
                      key={v}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
                    >
                      <input
                        type="radio"
                        name="gauge"
                        value={v}
                        checked={isSelected}
                        onChange={() => setCur(v)}
                        className="sr-only"
                      />
                      <div
                        className="w-7 text-center font-mono text-[0.7rem] font-semibold tabular-nums"
                        style={{ color: isSelected ? color : "var(--color-dim)" }}
                      >
                        {v > 0 ? `+${v}` : v}
                      </div>
                      <div
                        className="h-1.5 flex-1 rounded-full transition-all"
                        style={{
                          background: isSelected ? color : `${color}26`,
                          boxShadow: isSelected ? `0 0 10px ${color}80` : "none",
                        }}
                      />
                      <div
                        className="min-w-[5.5rem] text-right text-[0.68rem]"
                        style={{
                          color: isSelected ? "var(--color-text)" : "var(--color-muted)",
                        }}
                      >
                        {GAUGE_LABELS[v]}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-between text-[0.58rem] uppercase tracking-wider text-dim">
                <span>Euphoria</span>
                <span>Zone</span>
                <span>Fear</span>
              </div>

              <div>
                <label htmlFor="state-note" className="!text-[0.68rem]">
                  Note (optional)
                </label>
                <textarea
                  id="state-note"
                  name="note"
                  rows={2}
                  defaultValue={today?.note ?? ""}
                  placeholder="What's triggering this?"
                  className="!text-xs"
                />
              </div>

              <button type="submit" className="btn btn-primary w-full !py-2 !text-xs">
                Log
              </button>
            </form>
          </>
        )}

        {recent.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[0.6rem] uppercase tracking-wider text-muted">
              Last 14 days
            </div>
            <div className="flex flex-wrap gap-1">
              {recent.map((r) => {
                const color = gaugeColor(r.gauge);
                return (
                  <div
                    key={r.date}
                    className="h-3 w-3 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 4px ${color}66`,
                    }}
                    title={`${r.date} · ${GAUGE_LABELS[r.gauge]} (${r.gauge > 0 ? "+" : ""}${r.gauge})`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
