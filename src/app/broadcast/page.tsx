import { BroadcastWeekView, weekBounds } from "./_lib";

export default async function BroadcastPage() {
  const { start, end } = weekBounds(new Date());
  return <BroadcastWeekView start={start} end={end} isCurrent={true} />;
}
