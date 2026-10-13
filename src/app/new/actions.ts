"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isNull } from "drizzle-orm";
import { db, schema } from "@/db";

const MAX_OPEN_POSITIONS = 5;

function parseNumber(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createTrade(formData: FormData) {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const instrument = String(formData.get("instrument") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const thesis = String(formData.get("thesis") ?? "").trim();
  const emotion_before = String(formData.get("emotion_before") ?? "");
  const planned_size = parseNumber(formData.get("planned_size"));
  const conviction = parseNumber(formData.get("conviction"));

  if (!ticker || !thesis || planned_size == null || conviction == null) {
    throw new Error("Missing required fields");
  }

  // Hard-stop at MAX_OPEN_POSITIONS. The client form shows the warning and
  // requires an override checkbox; we re-check here so the limit holds even
  // if someone bypasses the client UI.
  const openCount = (
    await db.query.trades.findMany({ where: isNull(schema.trades.closed_at) })
  ).length;
  const override = formData.get("override_max_positions") === "1";
  if (openCount >= MAX_OPEN_POSITIONS && !override) {
    throw new Error(
      `Max ${MAX_OPEN_POSITIONS} open positions. Close one first or acknowledge the override on the form.`,
    );
  }

  const setupTypeRaw = String(formData.get("setup_type") ?? "").trim();
  const setup_type =
    (setupTypeRaw || null) as typeof schema.trades.$inferInsert.setup_type;
  const marketRegimeRaw = String(formData.get("market_regime") ?? "").trim();
  const market_regime =
    (marketRegimeRaw || null) as typeof schema.trades.$inferInsert.market_regime;

  await db.insert(schema.trades).values({
    opened_at: new Date(),
    ticker,
    instrument: instrument as typeof schema.trades.$inferInsert.instrument,
    direction: direction as typeof schema.trades.$inferInsert.direction,
    planned_size,
    strike: parseNumber(formData.get("strike")),
    expiration: (String(formData.get("expiration") ?? "").trim() || null),
    planned_entry: parseNumber(formData.get("planned_entry")),
    planned_stop: parseNumber(formData.get("planned_stop")),
    ...(() => {
      const tps = formData
        .getAll("tp")
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);
      return {
        planned_target: tps[0] ?? null,
        planned_target_2: tps[1] ?? null,
        planned_target_3: tps[2] ?? null,
        planned_targets: tps.length > 0 ? JSON.stringify(tps) : null,
      };
    })(),
    thesis,
    emotion_before: emotion_before as typeof schema.trades.$inferInsert.emotion_before,
    conviction,
    // ── Setup data ──
    setup_type,
    criteria_coiling: formData.get("criteria_coiling") ? 1 : 0,
    criteria_resistance: formData.get("criteria_resistance") ? 1 : 0,
    criteria_hh_hl: formData.get("criteria_hh_hl") ? 1 : 0,
    criteria_rel_strength: formData.get("criteria_rel_strength") ? 1 : 0,
    criteria_news: formData.get("criteria_news") ? 1 : 0,
    criteria_support: formData.get("criteria_support") ? 1 : 0,
    key_level: parseNumber(formData.get("key_level")),
    on_watchlist: formData.get("on_watchlist") ? 1 : 0,
    market_regime,
  });

  revalidatePath("/trades");
  revalidatePath("/");
  redirect("/trades");
}
