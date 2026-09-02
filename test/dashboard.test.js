import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDashboard } from '../src/dashboard.js';

test('dashboard is dark-first, supports light mode, and exposes Meta connect action', () => {
  const html = renderDashboard({
    settings: { auto_enabled: false, review_mode: true, followups_per_day: 2, min_gap_minutes: 240, silence_minutes: 180 },
    queues: [], contacts: [], connections: [], csrf: 'csrf-token', provider: 'meta_oauth'
  });
  assert.match(html, /localStorage\.getItem\('mt-theme'\)\|\|'dark'/);
  assert.match(html, /Connect Facebook & Instagram/);
  assert.match(html, /\/oauth\/meta\/start/);
  assert.match(html, /Global sending is paused/);
});
