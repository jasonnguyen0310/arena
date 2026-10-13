"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function updateTrims(id: number, formData: FormData) {
  const trims = String(formData.get("trims") ?? "").trim() || null;

  await db
    .update(schema.trades)
    .set({ trims })
    .where(eq(schema.trades.id, id));

  revalidatePath("/trades");
}

export async function reopenTrade(id: number) {
  await db
    .update(schema.trades)
    .set({ closed_at: null })
    .where(eq(schema.trades.id, id));

  revalidatePath("/trades");
  revalidatePath("/");
}
