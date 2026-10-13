"use client";

import { useEffect, useState } from "react";

const KEY = "arena.freshSlate";

export default function SessionScope() {
  const [mode, setMode] = useState<"all" | "today">("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      const on = stored === "1";
      setMode(on ? "today" : "all");
      document.documentElement.classList.toggle("fresh-slate", on);
      // Any previous reveal state is irrelevant now — we no longer use it.
      document.documentElement.classList.remove("history-revealed");
    } catch {}
  }, []);

  const choose = (next: "all" | "today") => {
    if (next === mode) return;
    setMode(next);
    const on = next === "today";
    document.documentElement.classList.toggle("fresh-slate", on);
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
  };

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/40 p-1.5">
      <div className="ml-3 text-[0.62rem] font-medium uppercase tracking-wider text-muted">
        Scope
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => choose("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            mode === "all"
              ? "bg-text text-bg"
              : "text-muted hover:bg-surface hover:text-text"
          }`}
        >
          All time
        </button>
        <button
          type="button"
          onClick={() => choose("today")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            mode === "today"
              ? "bg-text text-bg"
              : "text-muted hover:bg-surface hover:text-text"
          }`}
        >
          Today only
        </button>
      </div>
    </div>
  );
}
