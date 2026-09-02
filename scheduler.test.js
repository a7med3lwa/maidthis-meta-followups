import test from 'node:test';
import assert from 'node:assert/strict';
import { runTick, scheduleDue } from '../src/scheduler.js';

const settings = {
  auto_enabled: false,
  review_mode: true,
  timezone: 'America/Los_Angeles',
  business_start: '09:00:00',
  business_end: '19:00:00',
  followups_per_day: 2,
  min_gap_minutes: 240,
  silence_minutes: 180,
  standard_window_hours: 24,
  batch_size: 100
};

function fakeStore(contact) {
  const created = [];
  return {
    created,
    settings: async () => settings,
    schedulableContacts: async () => [contact],
    activeQueueForContact: async () => [],
    recentFollowups: async () => [],
    createQueue: async (row) => { created.push(row); return [{ id: 'q1', ...row }]; },
    dueQueues: async () => { throw new Error('Paused tick must not process queues'); }
  };
}

test('queues current_stage + 1 after staff replied and lead went silent', async () => {
  const store = fakeStore({
    id: 'c1', current_stage: 4, status: 'waiting',
    last_customer_at: '2026-09-02T14:00:00Z',
    last_page_at: '2026-09-02T14:10:00Z',
    last_followup_at: '2026-09-02T14:10:00Z'
  });
  const result = await scheduleDue(store, new Date('2026-09-02T18:30:00Z'));
  assert.equal(result.created, 1);
  assert.equal(store.created[0].stage, 5);
  assert.equal(store.created[0].expected_last_customer_at, '2026-09-02T14:00:00Z');
});

test('does not queue while the customer is waiting for a staff reply', async () => {
  const store = fakeStore({
    id: 'c1', current_stage: 4, status: 'replied',
    last_customer_at: '2026-09-02T14:20:00Z',
    last_page_at: '2026-09-02T14:10:00Z',
    last_followup_at: '2026-09-02T14:10:00Z'
  });
  const result = await scheduleDue(store, new Date('2026-09-02T19:30:00Z'));
  assert.equal(result.created, 0);
});

test('global pause still builds review items but never calls sender', async () => {
  const store = fakeStore({
    id: 'c1', current_stage: 0, status: 'waiting',
    last_customer_at: '2026-09-02T13:00:00Z',
    last_page_at: '2026-09-02T13:10:00Z',
    last_followup_at: null
  });
  const meta = { sendQueue: async () => { throw new Error('must not send'); } };
  const result = await runTick(store, meta, new Date('2026-09-02T18:00:00Z'));
  assert.equal(result.scheduled, 1);
  assert.equal(result.processed, 0);
});
