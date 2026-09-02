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

  async connectPageToken(token) {
    const page = await this.request('me?fields=id,name,username,instagram_business_account{id,name,username,profile_picture_url}', { token });
    if (!page?.id || !page?.name) throw new Error('Meta did not recognize this as a Page access token');
    await this.subscribePage(String(page.id), token);
    const shared = {
      page_id: String(page.id),
      token_ciphertext: encryptSecret(token, this.config.tokenEncryptionKey),
      scopes: ['page_access_token'],
      connected_by: 'Railway administrator',
      connected_by_user_id: null,
      status: 'connected'
    };
    const connected = [await this.store.upsertMetaConnection({
      ...shared,
      platform: 'messenger',
      business_account_id: String(page.id),
      account_name: page.name,
      username: page.username || null
    })];
    const instagram = page.instagram_business_account;
    if (instagram?.id) {
      connected.push(await this.store.upsertMetaConnection({
        ...shared,
        platform: 'instagram',
        business_account_id: String(instagram.id),
        account_name: instagram.name || instagram.username || `${page.name} Instagram`,
        username: instagram.username || null
      }));
    }
    await this.store.audit('meta_page_token_connected', {
      pageId: String(page.id),
      instagramId: instagram?.id ? String(instagram.id) : null
    });
    return connected;
  }
}
