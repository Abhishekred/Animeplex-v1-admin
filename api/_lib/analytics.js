/** Seven calendar-day buckets, based on UTC to avoid timezone gaps. */
export function auditWindow(now = Date.now()) {
  const current = new Date(now);
  const today = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  return { start: new Date(today - 6 * 86400000).toISOString(), today };
}

export function buildAuditTrend(rows, now = Date.now(), limit = 1000) {
  const { today } = auditWindow(now);
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(today - (6 - index) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));
  const byDay = new Map(days.map(day => [day.date, day]));
  for (const row of rows) {
    const time = Date.parse(row?.created_at);
    if (!Number.isFinite(time)) continue;
    const day = byDay.get(new Date(time).toISOString().slice(0, 10));
    if (day) day.count += 1;
  }
  return { days, total: days.reduce((sum, day) => sum + day.count, 0), truncated: rows.length >= limit };
}
