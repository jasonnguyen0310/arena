import { uploadScreenshot, deleteScreenshot } from "./screenshot-actions";
import type { TradeScreenshot } from "@/db/schema";

export default function ScreenshotSection({
  tradeId,
  shots,
}: {
  tradeId: number;
  shots: TradeScreenshot[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/30 p-5 space-y-4">
      <div>
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
          Screenshots
        </div>
        <p className="mt-1 text-xs text-muted">
          Chart snaps, broker fills, anything visual tied to this trade.
          PNG / JPG / WebP / GIF up to 10 MB each.
        </p>
      </div>

      {shots.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shots.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border/60 bg-surface/60 overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={`/api/screenshots/${s.filename}`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/screenshots/${s.filename}`}
                  alt={s.caption ?? "Trade screenshot"}
                  className="block h-40 w-full object-cover"
                />
              </a>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                <div className="text-xs text-muted truncate">
                  {s.caption || <span className="text-dim italic">no caption</span>}
                </div>
                <form action={deleteScreenshot.bind(null, s.id)}>
                  <button
                    type="submit"
                    className="text-[0.68rem] text-muted hover:text-loss"
                    aria-label={`Delete screenshot ${s.id}`}
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        action={uploadScreenshot.bind(null, tradeId)}
        encType="multipart/form-data"
        className="space-y-2"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor={`screenshot-${tradeId}`} className="text-[0.62rem] uppercase tracking-wider text-muted">
              Image
            </label>
            <input
              id={`screenshot-${tradeId}`}
              name="screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              className="!py-1.5 !text-sm"
            />
          </div>
          <div>
            <label htmlFor={`caption-${tradeId}`} className="text-[0.62rem] uppercase tracking-wider text-muted">
              Caption (optional)
            </label>
            <input
              id={`caption-${tradeId}`}
              name="caption"
              type="text"
              placeholder="e.g. 1min entry chart"
              className="!py-1.5 !text-sm"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-ghost !py-1.5 text-xs">
              Upload
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
