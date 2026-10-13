"use client";

import { useEffect, useState } from "react";

const KEY = "arena.freshSlate";

export default function FreshSlateToggle() {
  const [on, setOn] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      const enabled = stored === "1";
      setOn(enabled);
      document.documentElement.classList.toggle("fresh-slate", enabled);
    } catch {}
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("fresh-slate", next);
    if (!next) {
      // Turning off Fresh Slate also clears any temporary "show history" state.
      document.documentElement.classList.remove("history-revealed");
    }
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="nav-link flex items-center gap-1.5"
      aria-pressed={on}
      title={on ? "Fresh Slate on — today only" : "Enable Fresh Slate (today only)"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        {on && <circle cx="12" cy="12" r="3" fill="currentColor" />}
      </svg>
      <span className="hidden sm:inline">{on ? "Slate" : "Fresh"}</span>
    </button>
  );
}
