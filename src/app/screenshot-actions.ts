"use server";

import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

async function ensureDir() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

export async function uploadScreenshot(tradeId: number, formData: FormData) {
  const file = formData.get("screenshot");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large (max 10 MB)");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const ext = EXT_FOR_MIME[file.type];
  const filename = `trade_${tradeId}_${crypto.randomUUID()}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(SCREENSHOTS_DIR, filename), buffer);

  await db.insert(schema.trade_screenshots).values({
    trade_id: tradeId,
    filename,
    mime_type: file.type,
    caption,
    size_bytes: file.size,
    created_at: new Date(),
  });

  revalidatePath(`/trades/${tradeId}/edit`);
  revalidatePath(`/trades`);
}

export async function deleteScreenshot(screenshotId: number) {
  const row = await db.query.trade_screenshots.findFirst({
    where: eq(schema.trade_screenshots.id, screenshotId),
  });
  if (!row) return;

  // Delete DB row first so a failed unlink doesn't orphan an index entry.
  await db.delete(schema.trade_screenshots).where(eq(schema.trade_screenshots.id, screenshotId));

  const abs = path.join(SCREENSHOTS_DIR, row.filename);
  try {
    await fs.unlink(abs);
  } catch {
    // file already gone — fine
  }

  revalidatePath(`/trades/${row.trade_id}/edit`);
  revalidatePath(`/trades`);
}
