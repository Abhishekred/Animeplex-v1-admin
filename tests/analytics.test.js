import test from 'node:test';
import assert from 'node:assert/strict';
import { auditWindow, buildAuditTrend } from '../api/_lib/analytics.js';

test('audit activity is bucketed into the last seven UTC calendar days', () => {
  const now = Date.parse('2026-11-13T08:30:00Z');
  const rows = [
    { created_at: '2026-11-07T00:00:00Z' },
    { created_at: '2026-11-12T20:00:00Z' },
    { created_at: '2026-11-13T02:00:00Z' },
    { created_at: '2026-11-13T03:00:00Z' },
    { created_at: '2026-11-06T23:59:59Z' },
    { created_at: '2026-11-14T00:00:00Z' },
    { created_at: 'invalid' },
  ];
  const trend = buildAuditTrend(rows, now);
  assert.equal(auditWindow(now).start, '2026-11-07T00:00:00.000Z');
  assert.deepEqual(trend.days.map(day => day.count), [1, 0, 0, 0, 0, 1, 2]);
  assert.equal(trend.total, 4);
  assert.equal(trend.truncated, false);
  assert.equal(buildAuditTrend(rows.slice(0, 3), now, 3).truncated, true);
});
