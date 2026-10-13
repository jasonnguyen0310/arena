"use client";

import { useState } from "react";
import { replaceTrims } from "./trim-actions";
import { EMOTIONS_AFTER } from "@/lib/enums";

type Row = { contracts: string; price: string; pnl: string; why: string; emotion: string; date: string };

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToInput(d: Date | null | undefined): string {
  if (!d) return todayLocal();
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function TrimEditor({
  tradeId,
  existing,
}: {
  tradeId: number;
  existing: {
    contracts: number;
    price: number;
    pnl?: number | null;
    why?: string | null;
    emotion_after?: string | null;
    at?: Date | null;
  }[];
}) {
  const initial: Row[] =
    existing.length > 0
      ? existing.map((t) => ({
          contracts: String(t.contracts),
          price: String(t.price),
          pnl: t.pnl != null ? String(t.pnl) : "",
          why: t.why ?? "",
          emotion: t.emotion_after ?? "",
          date: dateToInput(t.at),
        }))
      : [{ contracts: "", price: "", pnl: "", why: "", emotion: "", date: todayLocal() }];
  const [rows, setRows] = useState<Row[]>(initial);

  const add = () =>
    setRows([...rows, { contracts: "", price: "", pnl: "", why: "", emotion: "", date: todayLocal() }]);
  const remove = (i: number) =>
    setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  const update = (i: number, field: keyof Row, val: string) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  const totalContracts = rows.reduce((s, r) => s + (Number(r.contracts) || 0), 0);
  const totalPnl = rows.reduce((s, r) => {
    const v = Number(r.pnl);
    return Number.isFinite(v) ? s + v : s;
  }, 0);

  return (
    <form action={replaceTrims.bind(null, tradeId)} className="space-y-3">
      <div className="space-y-3">
        {rows.map((r, i) => {
          const rowPnl = Number(r.pnl);
          const pnlColor =
            !Number.isFinite(rowPnl) || rowPnl === 0
              ? undefined
              : rowPnl > 0
              ? "var(--color-win)"
              : "var(--color-loss)";
          return (
            <div key={i} className="rounded-lg border border-border/70 bg-surface/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[0.68rem] font-medium uppercase tracking-wider text-muted">
                  Trim {i + 1}
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={
                    rows.length === 1 && !r.contracts && !r.price && !r.pnl && !r.why && !r.emotion
                  }
                  className="text-[0.68rem] text-muted hover:text-loss disabled:opacity-30"
                  aria-label={`Remove trim ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" step="any" min="0" placeholder="contracts" value={r.contracts} onChange={(e) => update(i, "contracts", e.target.value)} className="!py-1.5 !text-sm" />
                <input type="number" step="any" min="0" placeholder="price" value={r.price} onChange={(e) => update(i, "price", e.target.value)} className="!py-1.5 !text-sm" />
                <input type="number" step="any" placeholder="P&L ($)" value={r.pnl} onChange={(e) => update(i, "pnl", e.target.value)} className="!py-1.5 !text-sm pnl-value" style={{ color: pnlColor }} />
              </div>
              <div className="grid grid-cols-[1fr_9rem_7rem] gap-2">
                <input
                  type="text"
                  placeholder="Why did you trim?"
                  value={r.why}
                  onChange={(e) => update(i, "why", e.target.value)}
                  className="!py-1.5 !text-sm"
                />
                <select
                  value={r.emotion}
                  onChange={(e) => update(i, "emotion", e.target.value)}
                  className="!py-1.5 !text-sm"
                >
                  <option value="">Feeling…</option>
                  {EMOTIONS_AFTER.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={r.date}
                  onChange={(e) => update(i, "date", e.target.value)}
                  className="!py-1.5 !text-sm"
                  title="Date the trim was taken"
                />
              </div>
              {r.contracts !== "" && r.price !== "" && (
                <input
                  type="hidden"
                  name="trim"
                  value={JSON.stringify({
                    contracts: Number(r.contracts),
                    price: Number(r.price),
                    pnl: r.pnl !== "" && Number.isFinite(Number(r.pnl)) ? Number(r.pnl) : null,
                    why: r.why.trim() || null,
                    emotion_after: r.emotion || null,
                    date: r.date || null,
                  })}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={add} className="text-xs font-medium text-muted hover:text-text">
          + Add another trim
        </button>
        <div className="text-[0.68rem] text-muted">
          {totalContracts > 0 && (
            <>
              {totalContracts} contracts
              {totalPnl !== 0 && (
                <>
                  {" · "}
                  <span
                    className="pnl-value font-mono tabular-nums"
                    style={{ color: totalPnl > 0 ? "var(--color-win)" : totalPnl < 0 ? "var(--color-loss)" : undefined }}
                  >
                    {totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <button type="submit" className="btn btn-ghost w-full !py-1.5 !text-xs">
        Save trims
      </button>
    </form>
  );
}
