"use client";

import { useState } from "react";

type Row = { price: string };

export default function TargetEditor({
  initial = [],
}: {
  initial?: number[];
}) {
  const seed: Row[] =
    initial.length > 0
      ? initial.map((p) => ({ price: String(p) }))
      : [{ price: "" }];
  const [rows, setRows] = useState<Row[]>(seed);

  const add = () => setRows([...rows, { price: "" }]);
  const remove = (i: number) =>
    setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  const update = (i: number, val: string) =>
    setRows(rows.map((r, idx) => (idx === i ? { price: val } : r)));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-10 text-[0.68rem] uppercase tracking-wider text-muted">
            TP{i + 1}
          </span>
          <input
            type="number"
            step="any"
            name="tp"
            value={r.price}
            onChange={(e) => update(i, e.target.value)}
            placeholder={i === 0 ? "first trim price level" : `TP${i + 1} price level`}
            className="!py-1.5 !text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={rows.length === 1 && !r.price}
            className="text-[0.68rem] text-muted hover:text-loss disabled:opacity-30 w-16 text-right"
            aria-label={`Remove TP${i + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[0.72rem] uppercase tracking-wider text-muted hover:text-text"
      >
        + Add another TP
      </button>
    </div>
  );
}
