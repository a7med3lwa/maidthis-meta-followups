import { detectTemplateStage } from './template-matcher.js';
import { decryptSecret } from './token-crypto.js';
import { isStopMessage, renderTemplate } from './utils.js';

export class MetaClient {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.graph = `https://graph.facebook.com/${config.metaGraphVersion}`;
  }

  async tokenFor(accountId) {
    const connection = await this.store.metaConnectionByAccount(accountId);
    if (!connection?.token_ciphertext) throw new Error(`No active Meta connection for account ${accountId}`);
    return decryptSecret(connection.token_ciphertext, this.config.tokenEncryptionKey);
  }

  async graphRequest(path, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${this.graph}/${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(`Meta API: ${response.status} ${JSON.stringify(data.error || data)}`);
    return data;
  }

  async profile(accountId, userId) {
    try {
      return await this.graphRequest(`${userId}?fields=first_name,last_name`, { token: await this.tokenFor(accountId) });
    } catch { return {}; }
  }

  async sendPart(contact, payload) {
    return this.graphRequest(`${contact.business_account_id}/messages`, {
      method: 'POST', token: await this.tokenFor(contact.business_account_id),
      body: { recipient: { id: contact.platform_user_id }, messaging_type: 'RESPONSE', message: payload }
    });
  }

  async processWebhook(payload) {
    const templates = await this.store.templates();
    const platform = payload.object === 'instagram' ? 'instagram' : 'messenger';
    let processed = 0;
    for (const entry of payload.entry || []) {
      const accountId = String(entry.id);
      for (const event of entry.messaging || []) {
        const mid = event.message?.mid || `${accountId}:${event.sender?.id}:${event.timestamp}:${event.postback?.mid || 'activity'}`;
        if (!(await this.store.insertEvent(mid))) continue;
        const isEcho = Boolean(event.message?.is_echo);
        const userId = String(isEcho ? event.recipient?.id : event.sender?.id || '');
        if (!userId || userId === accountId) continue;
        let contact = await this.store.findContact(platform, accountId, userId);
        if (!contact) {
          const p = await this.profile(accountId, userId);
          contact = await this.store.upsertContact({ platform, business_account_id: accountId, platform_user_id: userId, first_name: p.first_name || null, last_name: p.last_name || null });
        }
        const when = new Date(event.timestamp || Date.now()).toISOString();
        const text = event.message?.text || event.postback?.title || '';
        if (isEcho) await this.handleOutbound(contact, mid, text, when, event, templates);
        else await this.handleInbound(contact, mid, text, when, event);
        processed += 1;
      }
    }
    return { processed };
  }

  async handleInbound(contact, mid, text, when, raw) {
    await this.store.insertMessage({ contact_id: contact.id, direction: 'inbound', external_message_id: mid, body: text || null, occurred_at: when, raw });
    const status = isStopMessage(text) ? 'opted_out' : 'replied';
    await this.store.updateContact(contact.id, { last_customer_at: when, status });
    await this.store.cancelQueue(contact.id, status === 'opted_out' ? 'opt_out_detected' : 'customer_replied');
    await this.store.audit('inbound_message', { status }, contact.id);
  }

  async handleOutbound(contact, mid, text, when, raw, templates) {
    const stage = detectTemplateStage(text, templates, contact);
    await this.store.insertMessage({ contact_id: contact.id, direction: 'outbound', external_message_id: mid, body: text || null, template_stage: stage, occurred_at: when, raw });
    const update = { last_page_at: when, status: 'waiting' };
    if (stage) Object.assign(update, { current_stage: Math.max(contact.current_stage, stage), last_followup_at: when });
    await this.store.updateContact(contact.id, update);
    if (stage) {
      const rows = await this.store.activeQueueForContact(contact.id);
      const matching = rows.find((q) => q.stage === stage);
      if (matching && matching.status !== 'sending') await this.store.updateQueue(matching.id, { status: 'sent_manual', sent_at: when });
    }
    await this.store.audit(stage ? 'manual_followup_detected' : 'outbound_message', { stage }, contact.id);
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
        const sent = await this.sendPart(contact, { text: body });
        textId = sent.message_id;
        await this.store.updateQueue(fresh.id, { text_message_id: textId });
        await this.store.insertMessage({ contact_id: contact.id, direction: 'outbound', external_message_id: textId, body, template_stage: fresh.stage, occurred_at: new Date().toISOString(), raw: sent });
      }
      if (template.media_file && !mediaId) {
        const url = `${this.config.publicBaseUrl}/media/${encodeURIComponent(template.media_file)}`;
        const sent = await this.sendPart(contact, { attachment: { type: 'image', payload: { url, is_reusable: true } } });
        mediaId = sent.message_id;
        await this.store.updateQueue(fresh.id, { media_message_id: mediaId });
        await this.store.insertMessage({ contact_id: contact.id, direction: 'outbound', external_message_id: mediaId, attachment_url: url, template_stage: fresh.stage, occurred_at: new Date().toISOString(), raw: sent });
      }
      const sentAt = new Date().toISOString();
      await this.store.updateContact(contact.id, { current_stage: fresh.stage, last_followup_at: sentAt, last_page_at: sentAt, status: fresh.stage === 10 ? 'completed' : 'waiting' });
      await this.store.updateQueue(fresh.id, { status: 'sent', sent_at: sentAt, text_message_id: textId, media_message_id: mediaId });
      await this.store.audit('followup_sent', { stage: fresh.stage, textId, mediaId }, contact.id, fresh.id);
      return { sent: true, stage: fresh.stage };
    } catch (error) {
      await this.store.updateQueue(fresh.id, { status: 'failed', last_error: error.message });
      await this.store.audit('followup_failed', { stage: fresh.stage, error: error.message }, contact.id, fresh.id);
      throw error;
    }
  }

  async block(queue, reason, status = 'cancelled') {
    await this.store.updateQueue(queue.id, { status, last_error: reason });
    await this.store.audit('followup_blocked', { reason }, queue.contact_id, queue.id);
    return { skipped: reason };
  }

  async backfill(accountId, platform = 'messenger') {
    const token = await this.tokenFor(accountId);
    const templates = await this.store.templates();
    const fields = `id,participants,messages.limit(${this.config.backfillMessagesPerConversation}){id,message,from,to,created_time,attachments}`;
    let url = `${accountId}/conversations?platform=${platform}&fields=${encodeURIComponent(fields)}&limit=50`;
    let count = 0;
    let imported = 0;
    while (url && count < this.config.backfillConversationLimit) {
      const page = url.startsWith('http') ? await fetch(url).then((r) => r.json()) : await this.graphRequest(url, { token });
      if (page.error) throw new Error(`Meta backfill: ${JSON.stringify(page.error)}`);
      for (const conversation of page.data || []) {
        if (count >= this.config.backfillConversationLimit) break;
        const person = (conversation.participants?.data || []).find((p) => String(p.id) !== String(accountId));
        if (!person) continue;
        let contact = await this.store.upsertContact({ platform, business_account_id: String(accountId), platform_user_id: String(person.id), first_name: person.name?.split(' ')[0] || null, last_name: person.name?.split(' ').slice(1).join(' ') || null });
        let stage = contact.current_stage;
        let lastCustomer = contact.last_customer_at;
        let lastPage = contact.last_page_at;
        const items = [...(conversation.messages?.data || [])].sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
        for (const message of items) {
          const outbound = String(message.from?.id) === String(accountId);
          const detected = outbound ? detectTemplateStage(message.message || '', templates, contact) : null;
          if (detected) stage = Math.max(stage, detected);
          if (outbound) lastPage = !lastPage || new Date(message.created_time) > new Date(lastPage) ? message.created_time : lastPage;
          else lastCustomer = !lastCustomer || new Date(message.created_time) > new Date(lastCustomer) ? message.created_time : lastCustomer;
          await this.store.insertMessage({ contact_id: contact.id, direction: outbound ? 'outbound' : 'inbound', external_message_id: message.id, body: message.message || null, template_stage: detected, occurred_at: message.created_time, raw: message });
          imported += 1;
        }
        await this.store.updateContact(contact.id, { current_stage: stage, last_customer_at: lastCustomer, last_page_at: lastPage, last_followup_at: stage ? lastPage : contact.last_followup_at, status: lastPage && (!lastCustomer || new Date(lastPage) > new Date(lastCustomer)) ? 'waiting' : 'replied' });
        count += 1;
      }
      url = page.paging?.next || null;
    }
    await this.store.audit('history_backfill', { accountId, platform, conversations: count, messages: imported });
    return { conversations: count, messages: imported };
  }
}
