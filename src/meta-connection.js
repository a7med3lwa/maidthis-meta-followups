import { encryptSecret } from './token-crypto.js';

export class MetaConnection {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.graph = `https://graph.facebook.com/${config.metaGraphVersion}`;
  }

  async request(path, { method = 'GET', token, body } = {}) {
    const url = path.startsWith('http') ? path : `${this.graph}/${path.replace(/^\//, '')}`;
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
      },
      body: body ? new URLSearchParams(body) : undefined
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { raw: text }; }
    if (!response.ok || data.error) throw new Error(`Meta API: ${response.status} ${JSON.stringify(data.error || data)}`);
    return data;
  }

  subscribePage(pageId, token) {
    return this.request(`${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: 'POST',
      token,
      body: { subscribed_fields: 'messages,messaging_postbacks,messaging_referrals' }
    });
  }

  async connectPageToken({ token, pageId, pageName = 'MaidThis Cleaning' }) {
    const normalizedPageId = String(pageId || '').trim();
    if (!/^\d+$/.test(normalizedPageId)) throw new Error('Enter the numeric Facebook Page ID shown in Meta');
    if (!String(token || '').trim()) throw new Error('Paste the Page access token from Meta');

    let subscriptionWarning = null;
    try { await this.subscribePage(normalizedPageId, token); }
    catch (error) {
      subscriptionWarning = 'The Page was saved, but Meta did not allow automatic webhook subscription. Keep the subscriptions already selected in Meta.';
      await this.store.audit('meta_subscription_warning', { pageId: normalizedPageId, error: error.message });
    }

    const connection = await this.store.upsertMetaConnection({
      page_id: normalizedPageId,
      token_ciphertext: encryptSecret(token, this.config.tokenEncryptionKey),
      scopes: ['page_access_token'],
      connected_by: 'Railway administrator',
      connected_by_user_id: null,
      status: 'connected',
      platform: 'messenger',
      business_account_id: normalizedPageId,
      account_name: String(pageName || '').trim() || `Facebook Page ${normalizedPageId}`,
      username: null
    });
    await this.store.audit('meta_page_token_connected', { pageId: normalizedPageId });
    return { connections: [connection], subscriptionWarning };
  }
}
