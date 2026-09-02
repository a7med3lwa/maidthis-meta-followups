import { latestDate, localDateKey, nextBusinessInstant } from './utils.js';

export async function scheduleDue(store, now = new Date()) {
  const settings = await store.settings();
  const contacts = await store.schedulableContacts(settings.batch_size * 5);
  const active = new Set();
  for (const contact of contacts) {
    for (const q of await store.activeQueueForContact(contact.id)) active.add(contact.id);
  }
  const recent = await store.recentFollowups(new Date(now.getTime() - 36 * 3_600_000));
  const todayKey = localDateKey(now, settings.timezone);
  const sentToday = new Map();
  const countedStages = new Set();
  for (const message of recent) {
    if (localDateKey(new Date(message.occurred_at), settings.timezone) === todayKey) {
      const key = `${message.contact_id}:${message.template_stage}`;
      if (!countedStages.has(key)) {
        countedStages.add(key);
        sentToday.set(message.contact_id, (sentToday.get(message.contact_id) || 0) + 1);
      }
    }
  }
  const created = [];
  for (const contact of contacts) {
    if (created.length >= settings.batch_size || active.has(contact.id)) continue;
    if (!contact.last_page_at || new Date(contact.last_page_at) <= new Date(contact.last_customer_at)) continue;
    const anchor = latestDate(contact.last_customer_at, contact.last_page_at, contact.last_followup_at);
    if (!anchor || now.getTime() - anchor.getTime() < settings.silence_minutes * 60_000) continue;
    let proposed = new Date(Math.max(now.getTime(), anchor.getTime() + settings.min_gap_minutes * 60_000));
    if ((sentToday.get(contact.id) || 0) >= settings.followups_per_day) proposed = new Date(proposed.getTime() + 24 * 3_600_000);
    proposed = nextBusinessInstant(proposed, settings);
    const rows = await store.createQueue({ contact_id: contact.id, stage: contact.current_stage + 1, scheduled_for: proposed.toISOString(), expected_last_customer_at: contact.last_customer_at });
    if (rows.length) created.push(rows[0]);
  }
  return { created: created.length, queues: created };
}

export async function runTick(store, messaging, now = new Date()) {
  const settings = await store.settings();
  const scheduled = await scheduleDue(store, now);
  const due = settings.auto_enabled ? await store.dueQueues(now, !settings.review_mode) : [];
  const results = [];
  for (const queue of due.slice(0, settings.batch_size)) {
    try { results.push({ id: queue.id, ...(await messaging.sendQueue(queue, settings)) }); }
    catch (error) { results.push({ id: queue.id, error: error.message }); }
  }
  return { scheduled: scheduled.created, processed: results.length, results };
}
