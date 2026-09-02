import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDashboard } from '../src/dashboard.js';

test('dashboard is dark-first and accepts a Page token without custom OAuth', () => {
  const html = renderDashboard({
    settings: { auto_enabled: false, review_mode: true, followups_per_day: 2, min_gap_minutes: 240, silence_minutes: 180 },
    queues: [], contacts: [], connections: [], csrf: 'csrf-token'
  });
  assert.match(html, /localStorage\.getItem\('mt-theme'\)\|\|'dark'/);
  assert.match(html, /Connect Meta Page/);
  assert.match(html, /name="page_access_token"/);
  assert.match(html, /type="password"/);
  assert.match(html, /Global sending is paused/);
  assert.doesNotMatch(html, /\/oauth\/meta/);
});
