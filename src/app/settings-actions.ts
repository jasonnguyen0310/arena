"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function setTaxRate(formData: FormData) {
  const raw = Number(formData.get("tax_rate"));
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) throw new Error("Invalid tax rate");
  const rate = raw > 1 ? raw / 100 : raw; // accept 37 or 0.37
  await db
    .insert(schema.settings)
    .values({ key: "tax_rate", value: String(rate) })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: String(rate) },
    });
  revalidatePath("/");
}

export async function getTaxRate(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "tax_rate") });
  if (!row) return 0.37;
  const v = Number(row.value);
  return Number.isFinite(v) ? v : 0.37;
}
