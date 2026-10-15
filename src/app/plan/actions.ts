"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function targetsFromForm(formData: FormData): string | null {
  const tps = formData
    .getAll("tp")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  return tps.length > 0 ? JSON.stringify(tps) : null;
}

export async function addTradeIdea(formData: FormData) {
  const planned_date = String(formData.get("planned_date") ?? "").trim();
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const direction = String(formData.get("direction") ?? "long");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planned_date)) throw new Error("Invalid date");
  if (!ticker) throw new Error("Missing ticker");

  const now = new Date();
  await db.insert(schema.trade_ideas).values({
    planned_date,
    ticker,
    direction: direction as typeof schema.trade_ideas.$inferInsert.direction,
    trigger_level: num(formData.get("trigger_level")),
    invalidation: num(formData.get("invalidation")),
    targets: targetsFromForm(formData),
    catalyst: str(formData.get("catalyst")),
    setup_type: str(formData.get("setup_type")),
    sizing_tier: num(formData.get("sizing_tier")),
    status: (str(formData.get("status")) as typeof schema.trade_ideas.$inferInsert.status) ?? "planned",
    notes: str(formData.get("notes")),
    created_at: now,
    updated_at: now,
  });

  revalidatePath("/plan");
  redirect("/plan");
}

export async function updateTradeIdea(id: number, formData: FormData) {
  const planned_date = String(formData.get("planned_date") ?? "").trim();
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const direction = String(formData.get("direction") ?? "long");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planned_date)) throw new Error("Invalid date");
  if (!ticker) throw new Error("Missing ticker");

  await db
    .update(schema.trade_ideas)
    .set({
      planned_date,
      ticker,
      direction: direction as typeof schema.trade_ideas.$inferInsert.direction,
      trigger_level: num(formData.get("trigger_level")),
      invalidation: num(formData.get("invalidation")),
      targets: targetsFromForm(formData),
      catalyst: str(formData.get("catalyst")),
      setup_type: str(formData.get("setup_type")),
      sizing_tier: num(formData.get("sizing_tier")),
      status: (str(formData.get("status")) as typeof schema.trade_ideas.$inferInsert.status) ?? "planned",
      notes: str(formData.get("notes")),
      updated_at: new Date(),
    })
    .where(eq(schema.trade_ideas.id, id));

  revalidatePath("/plan");
  redirect("/plan");
}

export async function deleteTradeIdea(id: number) {
  await db.delete(schema.trade_ideas).where(eq(schema.trade_ideas.id, id));
  revalidatePath("/plan");
}

export async function updateIdeaStatus(
  id: number,
  status: "planned" | "executed" | "passed" | "invalidated",
) {
  await db
    .update(schema.trade_ideas)
    .set({ status, updated_at: new Date() })
    .where(eq(schema.trade_ideas.id, id));
  revalidatePath("/plan");
}

export async function upsertWeeklyPlan(week_start: string, formData: FormData) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) throw new Error("Invalid week_start");

  const data = {
    week_start,
    spx_bias: str(formData.get("spx_bias")),
    qqq_bias: str(formData.get("qqq_bias")),
    smh_bias: str(formData.get("smh_bias")),
    macro_calendar: str(formData.get("macro_calendar")),
    notes: str(formData.get("notes")),
    updated_at: new Date(),
  };

  const existing = await db.query.weekly_plans.findFirst({
    where: eq(schema.weekly_plans.week_start, week_start),
  });
  if (existing) {
    await db.update(schema.weekly_plans).set(data).where(eq(schema.weekly_plans.week_start, week_start));
  } else {
    await db.insert(schema.weekly_plans).values(data);
  }

  revalidatePath("/plan");
}
