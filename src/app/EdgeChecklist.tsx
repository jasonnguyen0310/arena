"use client";

import { useEffect, useState } from "react";

const PILLARS = [
  {
    n: 1,
    title: "Strong fundamental story or catalyst",
    prompt: "Catalyst I understand and can say in one sentence.",
  },
  {
    n: 2,
    title: "Relative strength",
    prompt: "Stronger than the market. Leading its peers today.",
  },
  {
    n: 3,
    title: "Base / tight coiling",
    prompt: "Consolidation on the chart. Range compressing before the move.",
  },
  {
    n: 4,
    title: "Key level",
    prompt: "Holding above, or breaking out of, a defined level.",
  },
  {
    n: 5,
    title: "Higher lows",
    prompt: "Higher lows on the entry timeframe. Trend intact.",
  },
  {
    n: 6,
    title: "SPX / QQQ cooperating",
    prompt: "Broad tape agreeing with the trade, not fighting it.",
  },
] as const;

const STORAGE_KEY = "arena.edgeChecklist";

function useChecks() {
  const [checks, setChecks] = useState<boolean[]>(() => PILLARS.map(() => false));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === PILLARS.length) {
          setChecks(parsed.map((v) => !!v));
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  const toggle = (i: number) => {
    setChecks((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clear = () => {
    const next = PILLARS.map(() => false);
    setChecks(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return { checks, toggle, clear, hydrated };
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors"
      style={{
        borderColor: checked ? "#4ADE80" : "rgba(147,197,253,0.55)",
        background: checked ? "rgba(74,222,128,0.14)" : "transparent",
      }}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ color: "#4ADE80" }}
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export default function EdgeChecklist({
  compact = false,
  vertical = false,
}: {
  compact?: boolean;
  vertical?: boolean;
}) {
  const { checks, toggle, clear } = useChecks();
  const allChecked = checks.every(Boolean);
  const checkedCount = checks.filter(Boolean).length;

  if (vertical) {
    return (
      <div className="space-y-2">
        <div className="card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {PILLARS.map((p, i) => (
              <li key={p.n}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface/40"
                >
                  <CheckBox checked={checks[i]} />
                  <span
                    className="w-6 font-mono text-[0.72rem] font-semibold tabular-nums"
                    style={{ color: "#93C5FD" }}
                  >
                    {String(p.n).padStart(2, "0")}
                  </span>
                  <span
                    className="w-56 flex-shrink-0 text-sm font-semibold tracking-tight"
                    style={{
                      fontFamily: "var(--font-display)",
                      textDecoration: checks[i] ? "line-through" : "none",
                      opacity: checks[i] ? 0.55 : 1,
                    }}
                  >
                    {p.title}
                  </span>
                  <span
                    className="text-xs leading-snug text-muted"
                    style={{
                      textDecoration: checks[i] ? "line-through" : "none",
                      opacity: checks[i] ? 0.55 : 1,
                    }}
                  >
                    {p.prompt}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between px-1 text-[0.7rem] text-muted">
          <span>
            {checkedCount} / {PILLARS.length} checked
            {allChecked && (
              <span
                className="ml-2 font-semibold"
                style={{ color: "#4ADE80" }}
              >
                · all pillars met
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={clear}
            className="uppercase tracking-wider hover:text-text"
            disabled={checkedCount === 0}
            style={{ opacity: checkedCount === 0 ? 0.4 : 1 }}
          >
            Clear all
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6"
          : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
      }
    >
      {PILLARS.map((p, i) => (
        <button
          key={p.n}
          type="button"
          onClick={() => toggle(i)}
          className={`card flex flex-col text-left transition-colors hover:bg-surface/40 ${
            compact ? "p-3" : "p-4"
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckBox checked={checks[i]} />
            <div className="flex-1">
              <div
                className="font-mono text-[0.62rem] font-semibold tabular-nums"
                style={{ color: "#93C5FD" }}
              >
                {String(p.n).padStart(2, "0")}
              </div>
              <div
                className={
                  compact
                    ? "mt-0.5 text-xs font-semibold leading-tight tracking-tight"
                    : "mt-0.5 text-sm font-semibold leading-tight tracking-tight"
                }
                style={{
                  fontFamily: "var(--font-display)",
                  textDecoration: checks[i] ? "line-through" : "none",
                  opacity: checks[i] ? 0.55 : 1,
                }}
              >
                {p.title}
              </div>
            </div>
          </div>
          {!compact && (
            <div
              className="mt-2 text-[0.7rem] leading-snug text-muted"
              style={{
                textDecoration: checks[i] ? "line-through" : "none",
                opacity: checks[i] ? 0.55 : 1,
              }}
            >
              {p.prompt}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
