import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { renderDashboard } from './dashboard.js';
import { MetaClient } from './meta.js';
import { runTick } from './scheduler.js';
import { SupabaseStore } from './supabase.js';
import { timingSafeEqual, verifyMetaSignature } from './utils.js';

const config = loadConfig();
const store = new SupabaseStore(config);
const meta = new MetaClient(config, store);
const publicDir = join(fileURLToPath(new URL('..', import.meta.url)), 'public');

const send = (res, status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const readBody = (req) => new Promise((resolve, reject) => { const chunks=[]; let size=0; req.on('data',(c)=>{size+=c.length;if(size>2_000_000){reject(new Error('Body too large'));req.destroy();}else chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject); });
const parseForm = (buffer) => Object.fromEntries(new URLSearchParams(buffer.toString()));
const authorized = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const [user, password] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  return timingSafeEqual(user, config.adminUser) && timingSafeEqual(password, config.adminPassword);
};
const requireAdmin = (req, res) => { if (authorized(req)) return true; res.writeHead(401, { 'www-authenticate': 'Basic realm="MaidThis Follow-ups"' }); res.end('Authentication required'); return false; };
const requireInternal = (req, res) => { if (timingSafeEqual(req.headers['x-internal-token'], config.internalToken)) return true; send(res, 401, { error: 'unauthorized' }); return false; };

async function dashboard(res, notice = '') {
  const [settings, queues, contacts] = await Promise.all([store.settings(), store.dashboardQueue(), store.recentContacts()]);
  send(res, 200, renderDashboard({ settings, queues, contacts, csrf: config.adminFormToken, notice }), 'text/html');
}

async function adminAction(form) {
  if (!timingSafeEqual(form.csrf, config.adminFormToken)) throw new Error('Invalid form token');
  if (form.action === 'settings') {
    await store.updateSettings({ auto_enabled: form.auto_enabled === 'true', review_mode: form.review_mode === 'true', followups_per_day: Number(form.followups_per_day), min_gap_minutes: Number(form.min_gap_minutes), silence_minutes: Number(form.silence_minutes) });
    return 'Controls updated.';
  }
  if (form.action === 'contact_status') { await store.updateContact(form.contact_id, { status: form.status }); await store.cancelQueue(form.contact_id, `manually_marked_${form.status}`); return `Lead marked ${form.status}.`; }
  if (form.action === 'backfill') {
    if (!config.businessAccountId) throw new Error('META_BUSINESS_ACCOUNT_ID is required for backfill');
    const result = await meta.backfill(config.businessAccountId, config.platform);
    return `Imported ${result.conversations} conversations and ${result.messages} messages.`;
  }
  const queue = await store.queue(form.queue_id);
  if (!queue) throw new Error('Queue item not found');
  if (form.action === 'approve') { await store.updateQueue(queue.id, { status: 'approved', approved_at: new Date().toISOString() }); return `Follow-up #${queue.stage} approved.`; }
  if (form.action === 'send') { await store.updateQueue(queue.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: new Date().toISOString() }); const settings = await store.settings(); const result = await meta.sendQueue(queue, settings); return result.sent ? `Follow-up #${queue.stage} sent.` : `Not sent: ${result.skipped}.`; }
  if (form.action === 'skip') { await store.updateQueue(queue.id, { status: 'skipped' }); await store.updateContact(queue.contact_id, { current_stage: queue.stage }); return `Stage #${queue.stage} skipped without sending.`; }
  throw new Error('Unknown action');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.publicBaseUrl);
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/webhooks/meta') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && timingSafeEqual(url.searchParams.get('hub.verify_token'), config.metaVerifyToken)) return send(res, 200, url.searchParams.get('hub.challenge') || '', 'text/plain');
      return send(res, 403, { error: 'verification_failed' });
    }
    if (req.method === 'POST' && url.pathname === '/webhooks/meta') {
      const raw = await readBody(req);
      if (!verifyMetaSignature(raw, req.headers['x-hub-signature-256'], config.metaAppSecret)) return send(res, 401, { error: 'invalid_signature' });
      const result = await meta.processWebhook(JSON.parse(raw));
      return send(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname === '/internal/tick') { if (!requireInternal(req,res)) return; return send(res, 200, await runTick(store, meta)); }
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
  try { console.log('Scheduled tick', JSON.stringify(await runTick(store, meta))); }
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
