"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function setDailyState(formData: FormData) {
  const rawGauge = Number(formData.get("gauge"));
  if (!Number.isFinite(rawGauge)) throw new Error("Invalid gauge");
  const gauge = Math.max(-3, Math.min(3, Math.round(rawGauge)));
  const note = String(formData.get("note") ?? "").trim() || null;

  const date = todayKey();
  const updated_at = new Date();

  await db
    .insert(schema.daily_states)
    .values({ date, gauge, note, updated_at })
    .onConflictDoUpdate({
      target: schema.daily_states.date,
      set: { gauge, note, updated_at },
    });

  revalidatePath("/");
}
