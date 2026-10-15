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

export async function addMacroEvent(formData: FormData) {
  const event_date = String(formData.get("event_date") ?? "").trim();
  const event_type = String(formData.get("event_type") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) throw new Error("Invalid date");
  if (!event_type) throw new Error("Missing event type");

  const now = new Date();
  await db.insert(schema.macro_events).values({
    event_date,
    event_type: event_type as typeof schema.macro_events.$inferInsert.event_type,
    expectations: str(formData.get("expectations")),
    actual: str(formData.get("actual")),
    surprise: (str(formData.get("surprise")) as typeof schema.macro_events.$inferInsert.surprise) ?? null,
    days_before: str(formData.get("days_before")),
    days_after: str(formData.get("days_after")),
    spx_behavior_before: (str(formData.get("spx_behavior_before")) as typeof schema.macro_events.$inferInsert.spx_behavior_before) ?? null,
    spx_behavior_after: (str(formData.get("spx_behavior_after")) as typeof schema.macro_events.$inferInsert.spx_behavior_after) ?? null,
    qqq_behavior_before: (str(formData.get("qqq_behavior_before")) as typeof schema.macro_events.$inferInsert.qqq_behavior_before) ?? null,
    qqq_behavior_after: (str(formData.get("qqq_behavior_after")) as typeof schema.macro_events.$inferInsert.qqq_behavior_after) ?? null,
    smh_behavior_before: (str(formData.get("smh_behavior_before")) as typeof schema.macro_events.$inferInsert.smh_behavior_before) ?? null,
    smh_behavior_after: (str(formData.get("smh_behavior_after")) as typeof schema.macro_events.$inferInsert.smh_behavior_after) ?? null,
    notes: str(formData.get("notes")),
    created_at: now,
    updated_at: now,
  });

  revalidatePath("/macro");
  redirect("/macro");
}

export async function updateMacroEvent(id: number, formData: FormData) {
  const event_date = String(formData.get("event_date") ?? "").trim();
  const event_type = String(formData.get("event_type") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) throw new Error("Invalid date");
  if (!event_type) throw new Error("Missing event type");

  await db
    .update(schema.macro_events)
    .set({
      event_date,
      event_type: event_type as typeof schema.macro_events.$inferInsert.event_type,
      expectations: str(formData.get("expectations")),
      actual: str(formData.get("actual")),
      surprise: (str(formData.get("surprise")) as typeof schema.macro_events.$inferInsert.surprise) ?? null,
      days_before: str(formData.get("days_before")),
      days_after: str(formData.get("days_after")),
      spx_behavior_before: (str(formData.get("spx_behavior_before")) as typeof schema.macro_events.$inferInsert.spx_behavior_before) ?? null,
      spx_behavior_after: (str(formData.get("spx_behavior_after")) as typeof schema.macro_events.$inferInsert.spx_behavior_after) ?? null,
      qqq_behavior_before: (str(formData.get("qqq_behavior_before")) as typeof schema.macro_events.$inferInsert.qqq_behavior_before) ?? null,
      qqq_behavior_after: (str(formData.get("qqq_behavior_after")) as typeof schema.macro_events.$inferInsert.qqq_behavior_after) ?? null,
      smh_behavior_before: (str(formData.get("smh_behavior_before")) as typeof schema.macro_events.$inferInsert.smh_behavior_before) ?? null,
      smh_behavior_after: (str(formData.get("smh_behavior_after")) as typeof schema.macro_events.$inferInsert.smh_behavior_after) ?? null,
      notes: str(formData.get("notes")),
      updated_at: new Date(),
    })
    .where(eq(schema.macro_events.id, id));

  revalidatePath("/macro");
  redirect("/macro");
}

export async function deleteMacroEvent(id: number) {
  await db.delete(schema.macro_events).where(eq(schema.macro_events.id, id));
  revalidatePath("/macro");
}
