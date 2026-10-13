"use client";

import { useEffect, useState } from "react";

const KEY = "arena.hidePnl";

export default function HideToggle() {
  const [hidden, setHidden] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      const on = stored !== "0";
      setHidden(on);
      document.documentElement.classList.toggle("hide-pnl", on);
    } catch {}
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    document.documentElement.classList.toggle("hide-pnl", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  };

  if (!mounted) return null;

  const bg = hidden
    ? "linear-gradient(180deg, rgba(147,197,253,0.22), rgba(147,197,253,0.08))"
    : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))";
  const borderColor = hidden ? "rgba(147,197,253,0.75)" : "rgba(255,255,255,0.30)";
  const color = hidden ? "#93C5FD" : "var(--color-text)";
  const shadow = hidden
    ? "0 8px 32px -6px rgba(147,197,253,0.55)"
    : "0 8px 28px -6px rgba(0,0,0,0.6)";

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-pressed={hidden}
      title={hidden ? "P&L hidden — click to show" : "P&L visible — click to hide"}
      className="fixed bottom-6 left-6 z-[9998] flex items-center rounded-full border-2 font-semibold backdrop-blur transition-all"
      style={{
        background: bg,
        borderColor,
        color,
        boxShadow: shadow,
        padding: hover ? "0.75rem 1.25rem" : "0.65rem",
        gap: hover ? "0.6rem" : "0",
        letterSpacing: "0.02em",
      }}
    >
      {hidden ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-2.16 3.19" />
          <path d="M1 1l22 22" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      <span
        className="overflow-hidden whitespace-nowrap text-sm"
        style={{
          maxWidth: hover ? "16rem" : "0",
          opacity: hover ? 1 : 0,
          transition: "max-width 0.2s ease, opacity 0.15s ease",
        }}
      >
        {hidden ? "Focus mode · numbers hidden" : "Show P&L"}
      </span>
    </button>
  );
}
