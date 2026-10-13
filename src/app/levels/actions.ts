"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";

const PRICE_MATCH_EPSILON = 0.005; // treat prices within half a cent as the same level

export async function addKeyLevel(formData: FormData) {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const priceRaw = formData.get("price");
  const price = priceRaw != null && priceRaw !== "" ? Number(priceRaw) : NaN;
  const label = String(formData.get("label") ?? "resistance").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!ticker || !isFinite(price) || price <= 0) {
    throw new Error("Missing ticker or price");
  }

  // Dedupe: never override an existing entry. Trade-derived levels win — a manual
  // add matching a level already tagged on a trade is a no-op.
  const existingManual = await db.query.key_levels.findMany({
    where: eq(schema.key_levels.ticker, ticker),
  });
  if (existingManual.some((k) => Math.abs(k.price - price) < PRICE_MATCH_EPSILON)) {
    revalidatePath("/levels");
    return;
  }
  const tradedLevels = await db.query.trades.findMany({
    where: and(eq(schema.trades.ticker, ticker), isNotNull(schema.trades.key_level)),
  });
  if (
    tradedLevels.some(
      (t) => t.key_level != null && Math.abs(t.key_level - price) < PRICE_MATCH_EPSILON,
    )
  ) {
    revalidatePath("/levels");
    return;
  }

  await db.insert(schema.key_levels).values({
    ticker,
    price,
    label: label as typeof schema.key_levels.$inferInsert.label,
    note,
    updated_at: new Date(),
  });

  revalidatePath("/levels");
}

export async function deleteKeyLevel(id: number) {
  await db.delete(schema.key_levels).where(eq(schema.key_levels.id, id));
  revalidatePath("/levels");
}
