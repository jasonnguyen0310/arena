import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { updateMacroEvent } from "../../actions";
import { INDICES_BEHAVIOR } from "@/lib/enums";

export const dynamic = "force-dynamic";

const EVENT_TYPES = [
  { value: "CPI", label: "CPI" },
  { value: "PPI", label: "PPI" },
  { value: "FOMC", label: "FOMC" },
  { value: "NFP", label: "Jobs (NFP)" },
  { value: "GDP", label: "GDP" },
  { value: "other", label: "Other" },
] as const;

export default async function EditMacroEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const event = await db.query.macro_events.findFirst({
    where: eq(schema.macro_events.id, eventId),
  });
  if (!event) notFound();

  const action = updateMacroEvent.bind(null, eventId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
            Edit release
          </div>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
            {event.event_type} · {event.event_date}
          </h1>
        </div>
        <Link href="/macro" className="btn btn-ghost">← Back</Link>
      </div>

      <form action={action} className="card space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[9rem_9rem_1fr]">
          <div>
            <label htmlFor="event_date" className="text-[0.68rem] uppercase tracking-wider text-muted">Date</label>
            <input id="event_date" name="event_date" type="date" required defaultValue={event.event_date} className="!py-2" />
          </div>
          <div>
            <label htmlFor="event_type" className="text-[0.68rem] uppercase tracking-wider text-muted">Event</label>
            <select id="event_type" name="event_type" required defaultValue={event.event_type} className="!py-2">
              {EVENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="surprise" className="text-[0.68rem] uppercase tracking-wider text-muted">Surprise</label>
            <select id="surprise" name="surprise" defaultValue={event.surprise ?? ""} className="!py-2">
              <option value="">— pick after release —</option>
              <option value="hot">Hot (above estimate)</option>
              <option value="cold">Cold (below estimate)</option>
              <option value="in_line">In-line</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="expectations" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Expectations (consensus)
            </label>
            <textarea id="expectations" name="expectations" rows={2} defaultValue={event.expectations ?? ""} className="!py-2" />
          </div>
          <div>
            <label htmlFor="actual" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Actual (what came in)
            </label>
            <textarea id="actual" name="actual" rows={2} defaultValue={event.actual ?? ""} className="!py-2" />
          </div>
        </div>

        <div>
          <div className="mb-1 text-[0.68rem] uppercase tracking-wider text-muted">
            Indices behavior — before vs. after
          </div>
          <div className="space-y-3">
            {([
              ["spx", event.spx_behavior_before, event.spx_behavior_after, event.spx_behavior],
              ["qqq", event.qqq_behavior_before, event.qqq_behavior_after, event.qqq_behavior],
              ["smh", event.smh_behavior_before, event.smh_behavior_after, event.smh_behavior],
            ] as const).map(([idx, before, after, legacy]) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 md:grid-cols-[4rem_1fr_1fr] md:items-end"
              >
                <div className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted md:pb-2">
                  {idx.toUpperCase()}
                </div>
                <div>
                  <label htmlFor={`${idx}_behavior_before`} className="text-[0.62rem] uppercase tracking-wider text-muted">
                    Before
                  </label>
                  <select
                    id={`${idx}_behavior_before`}
                    name={`${idx}_behavior_before`}
                    defaultValue={before ?? legacy ?? ""}
                    className="!py-2"
                  >
                    <option value="">— pick one —</option>
                    {INDICES_BEHAVIOR.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${idx}_behavior_after`} className="text-[0.62rem] uppercase tracking-wider text-muted">
                    After
                  </label>
                  <select
                    id={`${idx}_behavior_after`}
                    name={`${idx}_behavior_after`}
                    defaultValue={after ?? ""}
                    className="!py-2"
                  >
                    <option value="">— pick after release —</option>
                    {INDICES_BEHAVIOR.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="days_before" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Days before — tape into the print
            </label>
            <textarea id="days_before" name="days_before" rows={4} defaultValue={event.days_before ?? ""} className="!py-2" />
          </div>
          <div>
            <label htmlFor="days_after" className="text-[0.68rem] uppercase tracking-wider text-muted">
              Days after — reaction
            </label>
            <textarea id="days_after" name="days_after" rows={4} defaultValue={event.days_after ?? ""} className="!py-2" />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="text-[0.68rem] uppercase tracking-wider text-muted">Notes / lesson</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={event.notes ?? ""} className="!py-2" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary !py-2">Save changes</button>
          <Link href="/macro" className="text-[0.72rem] uppercase tracking-wider text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
