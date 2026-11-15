import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignupTrend } from '../api/_lib/analytics.js';

test('signup trend creates seven ordered UTC buckets', () => {
  const now = Date.parse('2026-11-15T13:00:00Z');
  const result = buildSignupTrend([
    { created_at: '2026-11-15T01:00:00Z' },
    { created_at: '2026-11-14T23:59:59Z' },
    { created_at: '2026-11-09T00:00:00Z' },
    { created_at: '2026-11-08T23:59:59Z' },
    { created_at: null },
  ], now);
  assert.equal(result.days.length, 7);
  assert.equal(result.total, 3);
  assert.equal(result.days[0].date, '2026-11-09');
  assert.equal(result.days[0].count, 1);
  assert.equal(result.days[5].count, 1);
  assert.equal(result.days[6].count, 1);
  assert.equal(result.truncated, false);
});

test('signup trend marks capped results as incomplete', () => {
  const now = Date.parse('2026-11-15T00:00:00Z');
  const result = buildSignupTrend([{ created_at: '2026-11-15T00:00:00Z' }], now, 1);
  assert.equal(result.total, 1);
  assert.equal(result.truncated, true);
});
