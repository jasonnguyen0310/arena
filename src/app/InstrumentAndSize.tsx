"use client";

import { useState } from "react";
import { INSTRUMENTS, SIZING_TIERS } from "@/lib/enums";

type InstrumentValue = (typeof INSTRUMENTS)[number]["value"];

/**
 * Instrument-aware trade fields.
 *
 * Shares (stock) and options need different setup questions:
 *   - Shares: free-text dollar size, no strike/expiration.
 *   - Options: tier-locked size, strike + expiration shown.
 *
 * Owns the Instrument select plus the fields whose shape depends on it, so
 * the UI reacts to instrument changes without a page reload.
 */
export default function InstrumentAndSize({
  initialInstrument = "call",
  initialSize = "",
  initialStrike = "",
  initialExpiration = "",
}: {
  initialInstrument?: InstrumentValue;
  initialSize?: string;
  initialStrike?: string;
  initialExpiration?: string;
}) {
  const [instrument, setInstrument] = useState<InstrumentValue>(initialInstrument);
  const isShares = instrument === "stock";

  return (
    <>
      <div>
        <label htmlFor="instrument">Instrument</label>
        <select
          id="instrument"
          name="instrument"
          required
          value={instrument}
          onChange={(e) => setInstrument(e.target.value as InstrumentValue)}
        >
          {INSTRUMENTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="planned_size">
          Planned size ($){isShares ? " — dollars committed" : ""}
        </label>
        {isShares ? (
          <input
            id="planned_size"
            name="planned_size"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={initialSize}
            placeholder="e.g. 5000"
          />
        ) : (
          <select id="planned_size" name="planned_size" required defaultValue={initialSize}>
            <option value="" disabled>Pick a tier…</option>
            {SIZING_TIERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.tier}
              </option>
            ))}
          </select>
        )}
      </div>

      {!isShares && (
        <>
          <div>
            <label htmlFor="strike">Strike</label>
            <input id="strike" name="strike" type="number" step="any" placeholder="e.g. 250" defaultValue={initialStrike} />
          </div>
          <div>
            <label htmlFor="expiration">Expiration</label>
            <input id="expiration" name="expiration" type="date" defaultValue={initialExpiration} />
          </div>
        </>
      )}
    </>
  );
}
