"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

function parseNumber(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function closeTrade(id: number, formData: FormData) {
  const exit_price = parseNumber(formData.get("exit_price"));
  const pnl = parseNumber(formData.get("pnl"));
  const outcome = String(formData.get("outcome") ?? "");
  const emotion_after = String(formData.get("emotion_after") ?? "");
  const actual_entry = parseNumber(formData.get("actual_entry"));
  const market_context = String(formData.get("market_context") ?? "").trim() || null;
  const rules_followed = String(formData.get("rules_followed") ?? "").trim() || null;
  const rules_broken = String(formData.get("rules_broken") ?? "").trim() || null;
  const lesson = String(formData.get("lesson") ?? "").trim() || null;

  if (pnl == null || !outcome || !emotion_after) {
    throw new Error("Missing required fields");
  }

  const exitStrategyRaw = String(formData.get("exit_strategy") ?? "").trim();
  const exit_strategy =
    (exitStrategyRaw || null) as typeof schema.trades.$inferInsert.exit_strategy;
  const setupWorkedRaw = String(formData.get("setup_worked") ?? "").trim();
  const setup_worked =
    (setupWorkedRaw || null) as typeof schema.trades.$inferInsert.setup_worked;

  await db
    .update(schema.trades)
    .set({
      closed_at: new Date(),
      actual_entry,
      exit_price,
      pnl,
      outcome: outcome as typeof schema.trades.$inferInsert.outcome,
      emotion_after: emotion_after as typeof schema.trades.$inferInsert.emotion_after,
      market_context,
      rules_followed,
      rules_broken,
      lesson,
      exit_strategy,
      setup_worked,
    })
    .where(eq(schema.trades.id, id));

  revalidatePath("/trades");
  revalidatePath("/");
  redirect("/trades");
}
