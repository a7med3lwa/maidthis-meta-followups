import crypto from 'node:crypto';
import { decryptSecret, encryptSecret, signedState, verifySignedState } from './token-crypto.js';
import { escapeHtml } from './utils.js';

export class MetaOAuth {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.graph = `https://graph.facebook.com/${config.metaGraphVersion}`;
  }

  redirectUri() { return `${this.config.publicBaseUrl}/oauth/meta/callback`; }

  authorizeUrl() {
    const query = new URLSearchParams({
      client_id: this.config.metaAppId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      state: signedState(this.config.metaAppSecret),
      scope: this.config.metaOAuthScopes.join(','),
      auth_type: 'rerequest'
    });
    return `https://www.facebook.com/${this.config.metaGraphVersion}/dialog/oauth?${query}`;
  }

  verifyState(state) { return verifySignedState(state, this.config.metaAppSecret); }

  parseSignedRequest(value) {
    const [encodedSignature, encodedPayload] = String(value || '').split('.');
    if (!encodedSignature || !encodedPayload) throw new Error('Invalid Meta signed request');
    const expected = crypto.createHmac('sha256', this.config.metaAppSecret).update(encodedPayload).digest('base64url');
    if (encodedSignature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(encodedSignature), Buffer.from(expected))) throw new Error('Invalid Meta signed request signature');
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
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
    if (!response.ok || data.error) throw new Error(`Meta OAuth: ${response.status} ${JSON.stringify(data.error || data)}`);
    return data;
  }

  async exchangeCode(code) {
    const query = new URLSearchParams({
      client_id: this.config.metaAppId,
      client_secret: this.config.metaAppSecret,
      redirect_uri: this.redirectUri(),
      code
    });
    const short = await this.request(`oauth/access_token?${query}`);
    const longQuery = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.metaAppId,
      client_secret: this.config.metaAppSecret,
      fb_exchange_token: short.access_token
    });
    try { return await this.request(`oauth/access_token?${longQuery}`); }
    catch { return short; }
  }

  async pages(userToken) {
    const pages = [];
    let path = 'me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,name,username,profile_picture_url}&limit=100';
    while (path) {
      const page = await this.request(path, { token: userToken });
      pages.push(...(page.data || []));
      path = page.paging?.next || '';
    }
    return pages;
  }

  async callbackBundle(code) {
    const token = await this.exchangeCode(code);
    const [user, pages] = await Promise.all([
      this.request('me?fields=id,name', { token: token.access_token }),
      this.pages(token.access_token)
    ]);
    const payload = {
      exp: Date.now() + 15 * 60_000,
      user,
      pages: pages.map((page) => ({
        id: String(page.id),
        name: page.name,
        access_token: page.access_token,
        tasks: page.tasks || [],
        instagram: page.instagram_business_account ? {
          id: String(page.instagram_business_account.id),
          name: page.instagram_business_account.name || page.instagram_business_account.username,
          username: page.instagram_business_account.username || null,
          profile_picture_url: page.instagram_business_account.profile_picture_url || null
        } : null
      }))
    };
    return { payload: encryptSecret(JSON.stringify(payload), this.config.tokenEncryptionKey), user: payload.user, pages: payload.pages };
  }

  unpackBundle(value) {
    const bundle = JSON.parse(decryptSecret(value, this.config.tokenEncryptionKey));
    if (!bundle.exp || bundle.exp < Date.now()) throw new Error('The Meta account-selection session expired. Connect again.');
    return bundle;
  }

  renderChooser({ payload, user, pages, csrf }) {
    const cards = pages.map((page) => {
      const ig = page.instagram;
      return `<label class="account-option" data-search="${escapeHtml(page.name)} ${escapeHtml(page.id)} facebook"><input type="checkbox" name="account" value="messenger:${escapeHtml(page.id)}"><span class="network fb">f</span><span><strong>${escapeHtml(page.name)}</strong><small>Facebook Page · ${escapeHtml(page.id)}</small></span></label>${ig ? `<label class="account-option" data-search="${escapeHtml(ig.username || ig.name)} ${escapeHtml(page.name)} instagram"><input type="checkbox" name="account" value="instagram:${escapeHtml(ig.id)}"><span class="network ig">◎</span><span><strong>@${escapeHtml(ig.username || ig.name || 'Instagram')}</strong><small>Instagram professional account · linked to ${escapeHtml(page.name)}</small></span></label>` : ''}`;
    }).join('') || '<p class="empty">Meta did not return any Pages you can manage. Confirm that this Facebook profile has Page access.</p>';
    return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Select Meta accounts</title><style>${chooserStyles}</style></head><body><main><div class="brand"><span>M</span>MaidThis Follow-ups</div><section><div class="eyebrow">META CONNECTION</div><h1>Choose the inboxes to connect</h1><p>Signed in as <strong>${escapeHtml(user.name)}</strong>. Select only the MaidThis Page and Instagram account used for incoming leads.</p><input id="search" class="search" type="search" placeholder="Search Pages or Instagram accounts"><form method="post" action="/oauth/meta/connect"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><input type="hidden" name="bundle" value="${escapeHtml(payload)}"><div class="accounts">${cards}</div><div class="actions"><a href="/admin">Cancel</a><button type="submit">Connect selected accounts</button></div></form></section></main><script>const search=document.getElementById('search');search.oninput=()=>document.querySelectorAll('.account-option').forEach((item)=>item.hidden=!item.dataset.search.toLowerCase().includes(search.value.toLowerCase().trim()))</script></body></html>`;
  }

  async subscribePage(pageId, token) {
    return this.request(`${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: 'POST',
      token,
      body: { subscribed_fields: 'messages,messaging_postbacks,message_echoes,messaging_referrals' }
    });
  }

  async connectSelected(bundleValue, selected = []) {
    const bundle = this.unpackBundle(bundleValue);
    const requested = new Set(Array.isArray(selected) ? selected : [selected]);
    const connected = [];
    for (const page of bundle.pages) {
      const messengerKey = `messenger:${page.id}`;
      const instagramKey = page.instagram ? `instagram:${page.instagram.id}` : '';
      if (!requested.has(messengerKey) && !requested.has(instagramKey)) continue;
      await this.subscribePage(page.id, page.access_token);
      if (requested.has(messengerKey)) {
        connected.push(await this.store.upsertMetaConnection({
          platform: 'messenger', business_account_id: page.id, page_id: page.id,
          account_name: page.name, username: null,
          token_ciphertext: encryptSecret(page.access_token, this.config.tokenEncryptionKey),
          scopes: this.config.metaOAuthScopes, connected_by: bundle.user.name, connected_by_user_id: String(bundle.user.id), status: 'connected'
        }));
      }
      if (page.instagram && requested.has(instagramKey)) {
        connected.push(await this.store.upsertMetaConnection({
          platform: 'instagram', business_account_id: page.instagram.id, page_id: page.id,
          account_name: page.instagram.name || page.instagram.username || page.name,
          username: page.instagram.username,
          token_ciphertext: encryptSecret(page.access_token, this.config.tokenEncryptionKey),
          scopes: this.config.metaOAuthScopes, connected_by: bundle.user.name, connected_by_user_id: String(bundle.user.id), status: 'connected'
        }));
      }
    }
    if (!connected.length) throw new Error('Select at least one Facebook or Instagram account.');
    await this.store.audit('meta_oauth_connected', { accounts: connected.map((item) => ({ platform: item.platform, accountId: item.business_account_id })) });
    return connected;
  }
}

const chooserStyles = `:root{font-family:Inter,ui-sans-serif,system-ui;background:#080b12;color:#eef2ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 10%,#1d2854 0,transparent 32%),#080b12}main{max-width:820px;margin:auto;padding:48px 20px}.brand{display:flex;align-items:center;gap:12px;font-weight:800;margin-bottom:24px}.brand>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#7957ff,#22d3ee)}section{background:#101522;border:1px solid #252d40;border-radius:22px;padding:34px;box-shadow:0 24px 80px #0008}.eyebrow{font-size:12px;letter-spacing:.16em;color:#8fa4ff;font-weight:800}h1{font-size:32px;margin:8px 0}p,small{color:#98a4b8}.search{width:100%;height:44px;border:1px solid #2a3449;border-radius:11px;background:#0b101a;color:#eef2ff;padding:0 14px;margin-top:14px;outline:none}.search:focus{border-color:#7c66ff;box-shadow:0 0 0 3px #725bff22}.accounts{display:grid;gap:10px;margin:18px 0 28px}.account-option{display:flex;align-items:center;gap:14px;border:1px solid #2a3449;border-radius:14px;padding:16px;background:#151b2a;cursor:pointer}.account-option:has(input:checked){border-color:#7c66ff;background:#1b2037;box-shadow:0 0 0 3px #725bff22}.account-option input{width:18px;height:18px;accent-color:#7357ff}.account-option span:last-child{display:grid;gap:4px}.network{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:white;font-size:20px;font-weight:900}.fb{background:#1877f2}.ig{background:linear-gradient(135deg,#734ddd,#f43f5e,#f59e0b)}.actions{display:flex;justify-content:flex-end;align-items:center;gap:16px}.actions a{color:#aab5ca;text-decoration:none}button{border:0;border-radius:10px;background:linear-gradient(135deg,#7457ff,#4478ff);color:white;padding:12px 18px;font-weight:750;cursor:pointer}.empty{text-align:center;padding:28px}@media(max-width:560px){section{padding:22px}h1{font-size:26px}.actions{align-items:stretch;flex-direction:column-reverse;text-align:center}}`;
