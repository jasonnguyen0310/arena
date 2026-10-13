"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function acknowledgeWithdrawal(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const day_pnl = Number(formData.get("day_pnl"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  if (!Number.isFinite(day_pnl) || day_pnl <= 0) throw new Error("Not a green day");

  const withdraw_amount = Math.round(day_pnl * 60) / 100;
  const kept_amount = Math.round(day_pnl * 40) / 100;

  await db.insert(schema.withdrawals).values({
    date,
    day_pnl,
    withdraw_amount,
    kept_amount,
    acknowledged_at: new Date(),
  });

  revalidatePath("/");
}

export async function undoWithdrawal(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  await db.delete(schema.withdrawals).where(eq(schema.withdrawals.date, date));
  revalidatePath("/");
}
