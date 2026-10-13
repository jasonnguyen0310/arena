import { notFound, redirect } from "next/navigation";
import { BroadcastWeekView, slugToDate, weekBounds, weekSlug } from "../_lib";

export default async function BroadcastWeekPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const d = slugToDate(week);
  if (!d) notFound();
  const { start, end } = weekBounds(d);
  const currentSlug = weekSlug(new Date());
  const thisSlug = weekSlug(start);
  // If someone lands on /broadcast/<this-week-slug>, redirect to /broadcast for the canonical URL.
  if (thisSlug === currentSlug) redirect("/broadcast");
  return <BroadcastWeekView start={start} end={end} isCurrent={false} />;
}
