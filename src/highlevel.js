import { detectTemplateStage } from './template-matcher.js';
import { isStopMessage, renderTemplate } from './utils.js';

const platformForMessage = (message) => {
  const type = String(message.messageType || '').toUpperCase();
  if (type.includes('INSTAGRAM')) return 'instagram';
  if (type.includes('FACEBOOK')) return 'messenger';
  return null;
};

const splitName = (value = '') => {
  const [firstName, ...rest] = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: firstName || null, last_name: rest.join(' ') || null };
};

export class HighLevelClient {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.base = 'https://services.leadconnectorhq.com';
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.config.highlevelToken}`,
        version: this.config.highlevelApiVersion,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { raw: text }; }
    if (!response.ok) throw new Error(`HighLevel API: ${response.status} ${JSON.stringify(data)}`);
    return data;
  }

  async searchConversations(limit, startAfterDate = '') {
    const query = new URLSearchParams({
      locationId: this.config.highlevelLocationId,
      limit: String(Math.min(limit, 100)),
      sort: 'desc',
      status: 'all',
      sortBy: 'last_message_date'
    });
    if (startAfterDate) query.set('startAfterDate', startAfterDate);
    return this.request(`/conversations/search?${query}`);
  }

  async conversations(limit) {
    const all = [];
    let startAfterDate = '';
    while (all.length < limit) {
      const result = await this.searchConversations(limit - all.length, startAfterDate);
      const items = result.conversations || [];
      all.push(...items);
      const last = items.at(-1);
      const cursor = last?.lastMessageDate || last?.lastMessageDateTimestamp || last?.dateUpdated;
      if (!cursor || items.length < Math.min(100, limit - all.length + items.length)) break;
      startAfterDate = String(cursor);
    }
    return all.slice(0, limit);
  }

  async messages(conversationId, limit) {
    const all = [];
    let lastMessageId = '';
    while (all.length < limit) {
      const query = new URLSearchParams({
        limit: String(Math.min(100, limit - all.length)),
        type: 'TYPE_FACEBOOK,TYPE_INSTAGRAM'
      });
      if (lastMessageId) query.set('lastMessageId', lastMessageId);
      const page = await this.request(`/conversations/${encodeURIComponent(conversationId)}/messages?${query}`);
      const wrapper = page.messages || {};
      const items = wrapper.messages || [];
      all.push(...items);
      if (!wrapper.nextPage || !wrapper.lastMessageId || !items.length) break;
      lastMessageId = wrapper.lastMessageId;
    }
    return all.slice(0, limit);
  }

  async sync({ conversationLimit, messageLimit }) {
    const conversations = await this.conversations(conversationLimit);
    const templates = await this.store.templates();
    let imported = 0;
    for (const conversation of conversations) {
      const items = await this.messages(conversation.id, messageLimit);
      items.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
      for (const message of items) {
        const platform = platformForMessage(message);
        if (!platform || !message.contactId || !message.id) continue;
        if (!(await this.store.insertEvent(`ghl:${message.id}`))) continue;
        const names = splitName(conversation.fullName || conversation.contactName || '');
        let contact = await this.store.findContact(platform, this.config.highlevelLocationId, message.contactId);
        if (!contact) contact = await this.store.upsertContact({
          platform,
          business_account_id: this.config.highlevelLocationId,
          platform_user_id: message.contactId,
          ...names
        });
        const when = new Date(message.dateAdded || Date.now()).toISOString();
        if (message.direction === 'inbound') await this.handleInbound(contact, message, when);
        else if (message.direction === 'outbound') await this.handleOutbound(contact, message, when, templates);
        imported += 1;
      }
    }
    return { conversations: conversations.length, messages: imported };
  }

  syncRecent() {
    return this.sync({ conversationLimit: this.config.highlevelPollLimit, messageLimit: 40 });
  }

  backfill() {
    return this.sync({
      conversationLimit: this.config.backfillConversationLimit,
      messageLimit: this.config.backfillMessagesPerConversation
    });
  }

  async handleInbound(contact, message, when) {
    await this.store.insertMessage({
      contact_id: contact.id,
      direction: 'inbound',
      external_message_id: message.id,
      body: message.body || null,
      attachment_url: message.attachments?.[0] || null,
      occurred_at: when,
      raw: message
    });
    const status = isStopMessage(message.body || '') ? 'opted_out' : 'replied';
    await this.store.updateContact(contact.id, { last_customer_at: when, status });
    await this.store.cancelQueue(contact.id, status === 'opted_out' ? 'opt_out_detected' : 'customer_replied');
    await this.store.audit('highlevel_inbound', { status, channel: contact.platform }, contact.id);
  }

  async handleOutbound(contact, message, when, templates) {
    const stage = detectTemplateStage(message.body || '', templates, contact);
    await this.store.insertMessage({
      contact_id: contact.id,
      direction: 'outbound',
      external_message_id: message.id,
      body: message.body || null,
      attachment_url: message.attachments?.[0] || null,
      template_stage: stage,
      occurred_at: when,
      raw: message
    });
    const update = { last_page_at: when, status: 'waiting' };
    if (stage) Object.assign(update, { current_stage: Math.max(contact.current_stage, stage), last_followup_at: when });
    await this.store.updateContact(contact.id, update);
    if (stage) {
      const rows = await this.store.activeQueueForContact(contact.id);
      const matching = rows.find((q) => q.stage === stage);
      if (matching && matching.status !== 'sending') await this.store.updateQueue(matching.id, { status: 'sent_manual', sent_at: when });
    }
    await this.store.audit(stage ? 'manual_followup_detected' : 'highlevel_outbound', { stage, channel: contact.platform }, contact.id);
  }

  async sendPart(contact, payload) {
    return this.request('/conversations/messages', {
      method: 'POST',
      body: {
        type: contact.platform === 'instagram' ? 'IG' : 'FB',
        contactId: contact.platform_user_id,
        status: 'pending',
        ...payload
      }
    });
  }

  async sendQueue(queue, settings) {
    const fresh = await this.store.queue(queue.id);
    if (!fresh || !['pending','approved','sending'].includes(fresh.status)) return { skipped: 'not_sendable' };
    const contact = fresh.contacts;
    const template = fresh.followup_templates;
    if (!settings.auto_enabled) return { skipped: 'global_pause' };
    if (!['active','replied','waiting'].includes(contact.status)) return this.block(fresh, `contact_${contact.status}`);
    if (contact.current_stage + 1 !== fresh.stage) return this.block(fresh, 'stage_changed');
    if (fresh.expected_last_customer_at !== contact.last_customer_at) return this.block(fresh, 'customer_replied_after_queueing');
    const hours = (Date.now() - new Date(contact.last_customer_at).getTime()) / 3_600_000;
    if (hours > settings.standard_window_hours) return this.block(fresh, 'outside_standard_messaging_window', 'blocked_policy');

    await this.store.updateQueue(fresh.id, { status: 'sending', attempt_count: fresh.attempt_count + 1, last_error: null });
    try {
      let textId = fresh.text_message_id;
      let mediaId = fresh.media_message_id;
      const body = renderTemplate(template.body, contact);
      if (!textId) {
        const sent = await this.sendPart(contact, { message: body });
        textId = sent.messageId;
        const occurredAt = new Date().toISOString();
        await this.store.updateQueue(fresh.id, { text_message_id: textId });
        await this.store.insertEvent(`ghl:${textId}`);
        await this.store.insertMessage({ contact_id: contact.id, direction: 'outbound', external_message_id: textId, body, template_stage: fresh.stage, occurred_at: occurredAt, raw: sent });
      }
      if (template.media_file && !mediaId) {
        const url = `${this.config.publicBaseUrl}/media/${encodeURIComponent(template.media_file)}`;
        const sent = await this.sendPart(contact, { message: '', attachments: [url] });
        mediaId = sent.messageId;
        await this.store.updateQueue(fresh.id, { media_message_id: mediaId });
        await this.store.insertEvent(`ghl:${mediaId}`);
        await this.store.insertMessage({ contact_id: contact.id, direction: 'outbound', external_message_id: mediaId, attachment_url: url, template_stage: fresh.stage, occurred_at: new Date().toISOString(), raw: sent });
      }
      const sentAt = new Date().toISOString();
      await this.store.updateContact(contact.id, { current_stage: fresh.stage, last_followup_at: sentAt, last_page_at: sentAt, status: fresh.stage === 10 ? 'completed' : 'waiting' });
      await this.store.updateQueue(fresh.id, { status: 'sent', sent_at: sentAt, text_message_id: textId, media_message_id: mediaId });
      await this.store.audit('highlevel_followup_sent', { stage: fresh.stage, textId, mediaId, channel: contact.platform }, contact.id, fresh.id);
      return { sent: true, stage: fresh.stage };
    } catch (error) {
      await this.store.updateQueue(fresh.id, { status: 'failed', last_error: error.message });
      await this.store.audit('highlevel_followup_failed', { stage: fresh.stage, error: error.message }, contact.id, fresh.id);
      throw error;
    }
  }

  async block(queue, reason, status = 'cancelled') {
    await this.store.updateQueue(queue.id, { status, last_error: reason });
    await this.store.audit('followup_blocked', { reason }, queue.contact_id, queue.id);
    return { skipped: reason };
  }
}
