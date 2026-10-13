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

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function updateTrade(id: number, formData: FormData) {
  const ticker = str(formData.get("ticker"));
  const instrument = str(formData.get("instrument"));
  const direction = str(formData.get("direction"));
  const planned_size = parseNumber(formData.get("planned_size"));
  const strike = parseNumber(formData.get("strike"));
  const expiration = str(formData.get("expiration")) || null;
  const planned_entry = parseNumber(formData.get("planned_entry"));
  const planned_stop = parseNumber(formData.get("planned_stop"));
  const tps = formData
    .getAll("tp")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const planned_target = tps[0] ?? null;
  const planned_target_2 = tps[1] ?? null;
  const planned_target_3 = tps[2] ?? null;
  const planned_targets = tps.length > 0 ? JSON.stringify(tps) : null;
  const thesis = str(formData.get("thesis"));
  const emotion_before = str(formData.get("emotion_before"));
  const conviction = parseNumber(formData.get("conviction"));

  const actual_entry = parseNumber(formData.get("actual_entry"));
  const exit_price = parseNumber(formData.get("exit_price"));
  const pnl = parseNumber(formData.get("pnl"));
  const outcome = str(formData.get("outcome"));
  const emotion_after = str(formData.get("emotion_after"));
  const market_context = str(formData.get("market_context")) || null;
  const rules_followed = str(formData.get("rules_followed")) || null;
  const rules_broken = str(formData.get("rules_broken")) || null;
  const lesson = str(formData.get("lesson")) || null;

  const setup_type = (str(formData.get("setup_type")) || null) as typeof schema.trades.$inferInsert.setup_type;
  const key_level = parseNumber(formData.get("key_level"));
  const market_regime = (str(formData.get("market_regime")) || null) as typeof schema.trades.$inferInsert.market_regime;
  const exit_strategy = (str(formData.get("exit_strategy")) || null) as typeof schema.trades.$inferInsert.exit_strategy;
  const setup_worked = (str(formData.get("setup_worked")) || null) as typeof schema.trades.$inferInsert.setup_worked;

  if (!ticker || !instrument || !direction || planned_size == null || !thesis || !emotion_before || conviction == null) {
    throw new Error("Missing required plan fields");
  }

  await db
    .update(schema.trades)
    .set({
      ticker,
      instrument: instrument as typeof schema.trades.$inferInsert.instrument,
      direction: direction as typeof schema.trades.$inferInsert.direction,
      planned_size,
      strike,
      expiration,
      planned_entry,
      planned_stop,
      planned_target,
      planned_target_2,
      planned_target_3,
      planned_targets,
      thesis,
      emotion_before: emotion_before as typeof schema.trades.$inferInsert.emotion_before,
      conviction,
      actual_entry,
      exit_price,
      pnl,
      outcome: (outcome || null) as typeof schema.trades.$inferInsert.outcome,
      emotion_after: (emotion_after || null) as typeof schema.trades.$inferInsert.emotion_after,
      market_context,
      rules_followed,
      rules_broken,
      lesson,
      setup_type,
      criteria_coiling: formData.get("criteria_coiling") ? 1 : 0,
      criteria_resistance: formData.get("criteria_resistance") ? 1 : 0,
      criteria_hh_hl: formData.get("criteria_hh_hl") ? 1 : 0,
      criteria_rel_strength: formData.get("criteria_rel_strength") ? 1 : 0,
      criteria_news: formData.get("criteria_news") ? 1 : 0,
      criteria_support: formData.get("criteria_support") ? 1 : 0,
      key_level,
      on_watchlist: formData.get("on_watchlist") ? 1 : 0,
      market_regime,
      exit_strategy,
      setup_worked,
    })
    .where(eq(schema.trades.id, id));

  revalidatePath("/trades");
  revalidatePath("/");
  redirect("/trades");
}
