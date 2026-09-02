import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { renderDashboard } from './dashboard.js';
import { MetaClient } from './meta.js';
import { MetaConnection } from './meta-connection.js';
import { runTick } from './scheduler.js';
import { SupabaseStore } from './supabase.js';
import { escapeHtml, timingSafeEqual, verifyMetaSignature } from './utils.js';

const config = loadConfig();
const store = new SupabaseStore(config);
const messaging = new MetaClient(config, store);
const metaConnection = new MetaConnection(config, store);
const publicDir = join(fileURLToPath(new URL('..', import.meta.url)), 'public');

const send = (res, status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const readBody = (req) => new Promise((resolve, reject) => { const chunks=[]; let size=0; req.on('data',(c)=>{size+=c.length;if(size>2_000_000){reject(new Error('Body too large'));req.destroy();}else chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject); });
const parseForm = (buffer) => {
  const params = new URLSearchParams(buffer.toString());
  return Object.fromEntries(params);
};
const authorized = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const [user, password] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  return timingSafeEqual(user, config.adminUser) && timingSafeEqual(password, config.adminPassword);
};
const requireAdmin = (req, res) => { if (authorized(req)) return true; res.writeHead(401, { 'www-authenticate': 'Basic realm="MaidThis Follow-ups"' }); res.end('Authentication required'); return false; };
const requireInternal = (req, res) => { if (timingSafeEqual(req.headers['x-internal-token'], config.internalToken)) return true; send(res, 401, { error: 'unauthorized' }); return false; };
const escapeForPolicy = (value) => escapeHtml(value);
const policyPage = (title, content) => `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)} · MaidThis</title><style>:root{font-family:Inter,system-ui;background:#080b12;color:#eef3ff;color-scheme:dark}body{margin:0}main{max-width:760px;margin:auto;padding:60px 22px}.brand{color:#9a89ff;font-weight:850;letter-spacing:.04em}article{margin-top:22px;padding:32px;background:#101522;border:1px solid #263047;border-radius:18px;line-height:1.7}h1{line-height:1.15}h2{margin-top:28px;font-size:18px}p,li{color:#a8b2c5}a{color:#9a89ff}code{background:#1a2232;padding:3px 6px;border-radius:5px}</style></head><body><main><div class="brand">MAIDTHIS FOLLOW-UPS</div><article><h1>${escapeHtml(title)}</h1>${content}<p>Contact: <a href="mailto:${escapeHtml(config.privacyContactEmail)}">${escapeHtml(config.privacyContactEmail)}</a></p><p>Last updated: September 2, 2026</p></article></main></body></html>`;
const privacyPolicy = '<p>This application connects Facebook Pages and Instagram professional accounts authorized by a MaidThis administrator. It processes conversation identifiers, message content, timestamps, account names, and authorization tokens solely to organize and send requested sales follow-ups.</p><h2>Storage and security</h2><p>Authorization tokens are encrypted before database storage. Access is restricted to the MaidThis administrator account. Data is not sold or used for unrelated advertising.</p><h2>Retention and deletion</h2><p>Conversation data is retained while the integration is active for stage tracking, duplicate prevention, and auditing. An administrator can disconnect an account from the dashboard. Meta users may request deletion through the data-deletion URL or by email.</p><h2>Platform limitations</h2><p>Messages are processed only under Meta platform permissions and messaging-window rules.</p>';
const termsPolicy = '<p>This internal application is provided to MaidThis for managing Messenger and Instagram sales follow-ups. Users must have authority to connect each Page or Instagram professional account.</p><h2>Acceptable use</h2><p>The application may not be used to send deceptive, unlawful, unsolicited, or policy-violating messages. The operator must honor opt-outs and Meta messaging restrictions.</p><h2>Availability</h2><p>The service depends on Meta, Railway, and Supabase APIs and is provided without a guarantee of uninterrupted availability.</p>';
const deletionPolicy = '<p>To remove information associated with this application, disconnect every account from the application dashboard. This clears the encrypted authorization token and pauses contacts associated with that inbox.</p><p>You may also email the address below with the Facebook Page or Instagram username you want removed.</p>';

async function dashboard(res, notice = '') {
  const [settings, queues, contacts, connections] = await Promise.all([
    store.settings(), store.dashboardQueue(), store.recentContacts(),
    store.metaConnections()
  ]);
  send(res, 200, renderDashboard({ settings, queues, contacts, connections, csrf: config.adminFormToken, notice, provider: config.messagingProvider }), 'text/html');
}

async function adminAction(form) {
  if (!timingSafeEqual(form.csrf, config.adminFormToken)) throw new Error('Invalid form token');
  if (form.action === 'settings') {
    await store.updateSettings({ auto_enabled: form.auto_enabled === 'true', review_mode: form.review_mode === 'true', followups_per_day: Number(form.followups_per_day), min_gap_minutes: Number(form.min_gap_minutes), silence_minutes: Number(form.silence_minutes) });
    return 'Controls updated.';
  }
  if (form.action === 'contact_status') { await store.updateContact(form.contact_id, { status: form.status }); await store.cancelQueue(form.contact_id, `manually_marked_${form.status}`); return `Lead marked ${form.status}.`; }
  if (form.action === 'backfill') {
    const connection = await store.metaConnection(form.connection_id);
    if (!connection || connection.status !== 'connected') throw new Error('Choose an active Meta connection');
    const result = await messaging.backfill(connection.business_account_id, connection.platform);
    return `Imported ${result.conversations} conversations and ${result.messages} messages from ${connection.account_name}.`;
  }
  if (form.action === 'connect_meta_token') {
    const token = String(form.page_access_token || '').trim();
    if (!token) throw new Error('Paste the Page access token from Meta');
    const connected = await metaConnection.connectPageToken(token);
    return `Connected ${connected.map((item) => item.platform === 'instagram' ? `Instagram @${item.username || item.account_name}` : `Facebook Page ${item.account_name}`).join(' and ')}.`;
  }
  if (form.action === 'disconnect_meta') {
    const connection = await store.metaConnection(form.connection_id);
    if (connection) {
      for (const contact of await store.contactsByBusinessAccount(connection.business_account_id)) {
        await store.updateContact(contact.id, { status: 'paused' });
        await store.cancelQueue(contact.id, 'meta_connection_disconnected');
      }
    }
    await store.disconnectMetaConnection(form.connection_id);
    await store.audit('meta_connection_disconnected', { connectionId: form.connection_id });
    return 'Meta account disconnected from this app.';
  }
  const queue = await store.queue(form.queue_id);
  if (!queue) throw new Error('Queue item not found');
  if (form.action === 'approve') { await store.updateQueue(queue.id, { status: 'approved', approved_at: new Date().toISOString() }); return `Follow-up #${queue.stage} approved.`; }
  if (form.action === 'send') { await store.updateQueue(queue.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: new Date().toISOString() }); const settings = await store.settings(); const result = await messaging.sendQueue(queue, settings); return result.sent ? `Follow-up #${queue.stage} sent.` : `Not sent: ${result.skipped}.`; }
  if (form.action === 'skip') { await store.updateQueue(queue.id, { status: 'skipped' }); await store.updateContact(queue.contact_id, { current_stage: queue.stage }); return `Stage #${queue.stage} skipped without sending.`; }
  throw new Error('Unknown action');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.publicBaseUrl);
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/privacy') return send(res, 200, policyPage('Privacy Policy', privacyPolicy), 'text/html');
    if (req.method === 'GET' && url.pathname === '/terms') return send(res, 200, policyPage('Terms of Service', termsPolicy), 'text/html');
    if (req.method === 'GET' && url.pathname === '/data-deletion') return send(res, 200, policyPage('Meta Data Deletion', deletionPolicy), 'text/html');
    if (req.method === 'GET' && url.pathname === '/data-deletion/status') return send(res, 200, policyPage('Deletion Request', `<p>Your Meta connection data has been removed or scheduled for removal.</p><p>Confirmation: <code>${escapeForPolicy(url.searchParams.get('code') || 'not-provided')}</code></p>`), 'text/html');
    if (req.method === 'POST' && url.pathname === '/data-deletion') {
      const code = crypto.randomUUID();
      return send(res, 200, { url: `${config.publicBaseUrl}/data-deletion/status?code=${encodeURIComponent(code)}`, confirmation_code: code });
    }
    if (req.method === 'GET' && url.pathname === '/webhooks/meta') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && timingSafeEqual(url.searchParams.get('hub.verify_token'), config.metaVerifyToken)) return send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain');
      return send(res, 403, { error: 'verification_failed' });
    }
    if (req.method === 'POST' && url.pathname === '/webhooks/meta') {
      const raw = await readBody(req);
      if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'], config.metaAppSecret)) return send(res, 401, { error: 'invalid_signature' });
      const result = await messaging.processWebhook(JSON.parse(raw));
      return send(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname === '/internal/tick') {
      if (!requireInternal(req,res)) return;
      return send(res, 200, await runTick(store, messaging));
    }
    if (req.method === 'GET' && url.pathname === '/internal/summary') { if (!requireInternal(req,res)) return; const [settings,queue,contacts]=await Promise.all([store.settings(),store.dashboardQueue(),store.recentContacts()]); const counts=(items,key)=>Object.fromEntries(Object.entries(Object.groupBy(items,key)).map(([k,v])=>[k,v.length])); return send(res,200,{settings,queue_counts:counts(queue,q=>q.status),contact_counts:counts(contacts,c=>c.status)}); }
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const name = url.pathname.split('/').pop();
      if (!['skeleton.jpg','mr-bean.png'].includes(name)) return send(res,404,{error:'not_found'});
      const data = await readFile(join(publicDir, name));
      res.writeHead(200, { 'content-type': extname(name) === '.jpg' ? 'image/jpeg' : 'image/png', 'cache-control': 'public,max-age=86400' }); return res.end(data);
    }
    if (url.pathname === '/admin') {
      if (!requireAdmin(req,res)) return;
      if (req.method === 'GET') return dashboard(res);
      if (req.method === 'POST') { const notice = await adminAction(parseForm(await readBody(req))); return dashboard(res, notice); }
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) { console.error(error); return send(res, 500, { error: error.message }); }
});

let tickRunning = false;
async function scheduledTick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    console.log('Scheduled tick', JSON.stringify(await runTick(store, messaging)));
  }
  catch (error) { console.error('Scheduled tick failed', error); }
  finally { tickRunning = false; }
}

server.listen(config.port, () => {
  console.log(`MaidThis follow-up service listening on :${config.port}`);
  if (config.internalSchedulerEnabled) {
    console.log(`Built-in scheduler enabled every ${config.tickIntervalMinutes} minutes`);
    setTimeout(scheduledTick, 10_000).unref();
    setInterval(scheduledTick, config.tickIntervalMinutes * 60_000).unref();
  }
});
