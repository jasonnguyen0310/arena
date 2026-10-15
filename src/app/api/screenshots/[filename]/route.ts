import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // Guard against directory traversal — only accept basename-shaped filenames.
  if (!/^[\w.-]+$/.test(filename) || filename.includes("..")) {
    return new NextResponse("bad filename", { status: 400 });
  }

  // Confirm the file is actually registered before serving (so random probes
  // can't enumerate the on-disk screenshots directory).
  const row = await db.query.trade_screenshots.findFirst({
    where: eq(schema.trade_screenshots.filename, filename),
  });
  if (!row) return new NextResponse("not found", { status: 404 });

  const abs = path.join(process.cwd(), "data", "screenshots", filename);
  try {
    const buf = await fs.readFile(abs);
    const body = new Uint8Array(buf);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": row.mime_type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
