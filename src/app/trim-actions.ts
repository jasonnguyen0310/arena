"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function replaceTrims(tradeId: number, formData: FormData) {
  const raws = formData.getAll("trim").map((v) => String(v));
  type ParsedTrim = {
    contracts: number;
    price: number;
    pnl: number | null;
    why: string | null;
    emotion_after: string | null;
    date: string | null;
  };
  const parsed = raws
    .map((s) => {
      try {
        return JSON.parse(s) as ParsedTrim;
      } catch {
        return null;
      }
    })
    .filter(
      (t): t is ParsedTrim =>
        !!t &&
        Number.isFinite(t.contracts) &&
        t.contracts > 0 &&
        Number.isFinite(t.price) &&
        t.price > 0,
    );

  await db.delete(schema.trade_trims).where(eq(schema.trade_trims.trade_id, tradeId));

  if (parsed.length > 0) {
    const now = new Date();
    await db.insert(schema.trade_trims).values(
      parsed.map((t, i) => {
        // Parse the date (yyyy-mm-dd) as local time at market close (~4pm ET / 1pm PT).
        // Falls back to "now" if the field is missing or malformed.
        let at: Date = now;
        if (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
          const [y, m, d] = t.date.split("-").map(Number);
          at = new Date(y, m - 1, d, 13, 0, 0); // 1pm local
        }
        return {
          trade_id: tradeId,
          ordinal: i + 1,
          contracts: t.contracts,
          price: t.price,
          pnl: t.pnl != null && Number.isFinite(t.pnl) ? t.pnl : null,
          why: t.why,
          emotion_after: t.emotion_after as typeof schema.trade_trims.$inferInsert.emotion_after,
          at,
        };
      }),
    );
  }

  revalidatePath("/trades");
  revalidatePath("/");
}
