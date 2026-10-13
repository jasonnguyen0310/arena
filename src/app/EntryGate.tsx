"use client";

import { useEffect, useState } from "react";

const KEY_PREFIX = "arena.entryAck.";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EntryGate() {
  const [ready, setReady] = useState(false); // avoid SSR flash
  const [ack, setAck] = useState<boolean>(true); // assume acked to avoid flash on first render

  useEffect(() => {
    try {
      const key = KEY_PREFIX + todayKey();
      const stored = localStorage.getItem(key);
      setAck(stored === "1");
    } catch {
      setAck(true);
    }
    setReady(true);
  }, []);

  const acknowledge = () => {
    try {
      localStorage.setItem(KEY_PREFIX + todayKey(), "1");
    } catch {}
    setAck(true);
  };

  if (!ready || ack) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto"
      style={{
        background: "rgba(8,8,10,0.92)",
        backdropFilter: "blur(16px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Enter the Arena"
    >
      <div className="mx-auto my-10 w-full max-w-3xl px-6">
        <div className="text-center">
          <div
            className="text-xs tracking-[0.32em] text-muted"
            style={{ fontFamily: "var(--font-display)" }}
          >
            BEFORE YOU TRADE
          </div>
          <h1
            className="mt-2 text-3xl tracking-[0.22em] text-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            READ. INTERNALIZE. ENTER.
          </h1>
        </div>

        {/* 5 Truths */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
            border: "1px solid rgba(147,197,253,0.28)",
          }}
        >
          <div
            className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "#93C5FD" }}
          >
            5 Fundamental Truths
          </div>
          <ol className="grid gap-x-8 gap-y-2 text-sm leading-snug text-text md:grid-cols-2">
            <li className="flex gap-2">
              <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span>
              <span>Anything can happen.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span>
              <span>You don&apos;t need to know what happens next to make money.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span>
              <span>Wins and losses are randomly distributed for any given edge.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span>
              <span>An edge is only a higher probability of one thing over another.</span>
            </li>
            <li className="flex gap-2 md:col-span-2">
              <span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span>
              <span>Every moment in the market is unique.</span>
            </li>
          </ol>
        </div>

        {/* 7 Principles */}
        <div
          className="mt-6 rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(147,197,253,0.08), rgba(147,197,253,0.02))",
            border: "1px solid rgba(147,197,253,0.28)",
          }}
        >
          <div
            className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "#93C5FD" }}
          >
            7 Principles of Consistency
          </div>
          <p className="mb-3 text-sm italic text-muted">
            I am a consistent winner because&hellip;
          </p>
          <ol className="grid gap-x-8 gap-y-2 text-sm leading-snug text-text md:grid-cols-2">
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>1.</span><span>I objectively identify my edges.</span></li>
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>2.</span><span>I predefine the risk of every trade.</span></li>
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>3.</span><span>I completely accept the risk, or I am willing to let go of the trade.</span></li>
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>4.</span><span>I act on my edges without reservation or hesitation.</span></li>
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>5.</span><span>I pay myself as the market makes money available to me.</span></li>
            <li className="flex gap-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>6.</span><span>I continually monitor my susceptibility for making errors.</span></li>
            <li className="flex gap-2 md:col-span-2"><span className="font-mono font-semibold" style={{ color: "#93C5FD" }}>7.</span><span>I understand the absolute necessity of these principles &mdash; and therefore, I never violate them.</span></li>
          </ol>
          <div
            className="mt-5 border-t pt-4 text-center italic leading-relaxed"
            style={{ borderColor: "rgba(147,197,253,0.18)" }}
          >
            <div
              className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em]"
              style={{ color: "#93C5FD" }}
            >
              Mantra
            </div>
            I am a consistently profitable trader.
            <br />
            I am a consistently profitable trader.
            <br />
            I am a consistently profitable trader.
            <br />
            I am a professional risk manager.
            <br />
            I am a professional risk manager.
            <br />
            I am a professional risk manager.
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <button type="button" onClick={acknowledge} className="btn btn-primary !px-8 !py-3">
            I&apos;ve read this. Enter the arena.
          </button>
          <div className="text-[0.62rem] uppercase tracking-wider text-dim">
            Required once per day
          </div>
        </div>
      </div>
    </div>
  );
}
