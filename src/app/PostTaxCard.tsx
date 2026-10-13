"use client";

import { useState } from "react";
import { setTaxRate } from "./settings-actions";

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pnlColor(n: number) {
  if (n > 0) return "var(--color-win)";
  if (n < 0) return "var(--color-loss)";
  return "var(--color-scratch)";
}

export default function PostTaxCard({
  grossPnl,
  taxRate,
}: {
  grossPnl: number;
  taxRate: number;
}) {
  const [editing, setEditing] = useState(false);
  // Only tax positive gross P&L. Losses aren't refunded (they carry).
  const taxes = grossPnl > 0 ? grossPnl * taxRate : 0;
  const net = grossPnl - taxes;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted">Post-tax P&L · California</div>
          <div
            className="pnl-value mt-2 font-mono text-2xl font-semibold tabular-nums"
            style={{ color: pnlColor(net) }}
          >
            {fmtMoney(net)}
          </div>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[0.62rem] uppercase tracking-wider text-muted hover:text-text"
          >
            Rate {(taxRate * 100).toFixed(1)}%
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[0.62rem] uppercase tracking-wider text-muted hover:text-text"
          >
            Close
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-muted">
        gross <span className="pnl-value font-mono tabular-nums text-text">{fmtMoney(grossPnl)}</span>
        {" · "}
        est. tax{" "}
        <span className="pnl-value font-mono tabular-nums text-text">
          {taxes > 0 ? `-$${taxes.toFixed(2)}` : "$0.00"}
        </span>
      </div>

      {editing && (
        <form action={setTaxRate} className="mt-4 border-t border-border pt-3">
          <label htmlFor="tax_rate" className="!text-[0.62rem]">
            Combined effective tax rate (%)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="tax_rate"
              name="tax_rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={(taxRate * 100).toFixed(1)}
              className="!py-1.5 !text-sm"
            />
            <button type="submit" className="btn btn-primary !py-1.5 !px-3 !text-xs">
              Save
            </button>
          </div>
          <p className="mt-2 text-[0.62rem] leading-relaxed text-dim">
            Rough estimate. CA + federal short-term ordinary combined is ~32–40% for most brackets.
            Applied only to positive P&L; losses carry forward.
          </p>
        </form>
      )}
    </div>
  );
}
