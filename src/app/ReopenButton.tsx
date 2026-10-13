"use client";

import { reopenTrade } from "./trades/[id]/actions";

export default function ReopenButton({ tradeId, ticker }: { tradeId: number; ticker: string }) {
  return (
    <form
      action={reopenTrade.bind(null, tradeId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `Reopen ${ticker}? The debrief stays, but the trade goes back to "open" — payouts and stats for this trade will disappear until you close it again.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn btn-ghost">
        Reopen
      </button>
    </form>
  );
}
