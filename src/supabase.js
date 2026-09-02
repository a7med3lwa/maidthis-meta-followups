export class SupabaseStore {
  constructor(config) {
    this.base = `${config.supabaseUrl}/rest/v1`;
    this.headers = {
      apikey: config.supabaseKey,
      'content-type': 'application/json'
    };
    if (config.supabaseKey.startsWith('eyJ')) this.headers.authorization = `Bearer ${config.supabaseKey}`;
  }

  async request(path, { method = 'GET', body, prefer } = {}) {
    const response = await fetch(`${this.base}/${path}`, {
      method,
      headers: { ...this.headers, ...(prefer ? { prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${method} ${path}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  }

  one(path) { return this.request(path).then((rows) => rows?.[0] || null); }
  settings() { return this.one('automation_settings?id=eq.true&select=*'); }
  templates() { return this.request('followup_templates?enabled=eq.true&select=*&order=stage.asc'); }
  contact(id) { return this.one(`contacts?id=eq.${encodeURIComponent(id)}&select=*`); }
  findContact(platform, businessId, userId) {
    return this.one(`contacts?platform=eq.${platform}&business_account_id=eq.${encodeURIComponent(businessId)}&platform_user_id=eq.${encodeURIComponent(userId)}&select=*`);
  }
  async upsertContact(data) {
    const rows = await this.request('contacts?on_conflict=platform,business_account_id,platform_user_id', {
      method: 'POST', body: data, prefer: 'resolution=merge-duplicates,return=representation'
    });
    return rows[0];
  }
  updateContact(id, data) {
    return this.request(`contacts?id=eq.${id}`, { method: 'PATCH', body: { ...data, updated_at: new Date().toISOString() }, prefer: 'return=representation' });
  }
  insertMessage(data) {
    const query = data.external_message_id ? '?on_conflict=external_message_id' : '';
    return this.request(`messages${query}`, { method: 'POST', body: data, prefer: 'resolution=ignore-duplicates,return=representation' });
  }
  async insertEvent(eventId) {
    const rows = await this.request('webhook_events?on_conflict=event_id', { method: 'POST', body: { event_id: eventId }, prefer: 'resolution=ignore-duplicates,return=representation' });
    return rows.length > 0;
  }
  activeQueueForContact(contactId) {
    return this.request(`followup_queue?contact_id=eq.${contactId}&status=in.(pending,approved,sending)&select=*`);
  }
  cancelQueue(contactId, reason = 'customer_replied') {
    return this.request(`followup_queue?contact_id=eq.${contactId}&status=in.(pending,approved,blocked_policy,failed)`, {
      method: 'PATCH', body: { status: 'cancelled', last_error: reason, updated_at: new Date().toISOString() }
    });
  }
  async createQueue(data) {
    const rows = await this.request('followup_queue?on_conflict=contact_id,stage', {
      method: 'POST', body: data, prefer: 'resolution=ignore-duplicates,return=representation'
    });
    if (rows.length) return rows;
    const existing = await this.one(`followup_queue?contact_id=eq.${data.contact_id}&stage=eq.${data.stage}&select=*`);
    if (existing?.status === 'cancelled') {
      return this.updateQueue(existing.id, { status: 'pending', scheduled_for: data.scheduled_for, expected_last_customer_at: data.expected_last_customer_at, text_message_id: null, media_message_id: null, attempt_count: 0, last_error: null, approved_at: null, sent_at: null });
    }
    return [];
  }
  queue(id) { return this.one(`followup_queue?id=eq.${id}&select=*,contacts(*),followup_templates(*)`); }
  updateQueue(id, data) {
    return this.request(`followup_queue?id=eq.${id}`, { method: 'PATCH', body: { ...data, updated_at: new Date().toISOString() }, prefer: 'return=representation' });
  }
  dueQueues(now, includePending) {
    const statuses = includePending ? '(pending,approved)' : '(approved)';
    return this.request(`followup_queue?status=in.${statuses}&scheduled_for=lte.${encodeURIComponent(now.toISOString())}&select=*,contacts(*),followup_templates(*)&order=scheduled_for.asc&limit=200`);
  }
  schedulableContacts(limit) {
    return this.request(`contacts?status=in.(active,replied,waiting)&current_stage=lt.10&last_customer_at=not.is.null&last_page_at=not.is.null&select=*&order=last_page_at.asc&limit=${limit}`);
  }
  recentFollowups(since) {
    return this.request(`messages?direction=eq.outbound&template_stage=not.is.null&occurred_at=gte.${encodeURIComponent(since.toISOString())}&select=contact_id,template_stage,occurred_at`);
  }
  dashboardQueue() {
    return this.request('followup_queue?status=in.(pending,approved,blocked_policy,failed)&select=*,contacts(*),followup_templates(*)&order=scheduled_for.asc&limit=250');
  }
  recentContacts() { return this.request('contacts?select=*&order=updated_at.desc&limit=100'); }
  metaConnections() {
    return this.request('meta_connections?status=eq.connected&select=id,platform,business_account_id,page_id,account_name,username,connected_by,status,last_verified_at,created_at,updated_at&order=created_at.asc');
  }
  metaConnection(id) { return this.one(`meta_connections?id=eq.${encodeURIComponent(id)}&select=*`); }
  metaConnectionByAccount(accountId) {
    return this.one(`meta_connections?business_account_id=eq.${encodeURIComponent(accountId)}&status=eq.connected&select=*`);
  }
  contactsByBusinessAccount(accountId) {
    return this.request(`contacts?business_account_id=eq.${encodeURIComponent(accountId)}&select=id`);
  }
  async upsertMetaConnection(data) {
    const rows = await this.request('meta_connections?on_conflict=platform,business_account_id', {
      method: 'POST', body: { ...data, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=representation'
    });
    return rows[0];
  }
  disconnectMetaConnection(id) {
    return this.request(`meta_connections?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', body: { status: 'disconnected', token_ciphertext: null, updated_at: new Date().toISOString() }, prefer: 'return=representation'
    });
  }
  updateSettings(data) { return this.request('automation_settings?id=eq.true', { method: 'PATCH', body: { ...data, updated_at: new Date().toISOString() }, prefer: 'return=representation' }); }
  audit(action, detail = {}, contactId = null, queueId = null) {
    return this.request('audit_log', { method: 'POST', body: { action, detail, contact_id: contactId, queue_id: queueId } });
  }
}
