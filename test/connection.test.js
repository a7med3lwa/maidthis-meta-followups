import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaConnection } from '../src/meta-connection.js';
import { MetaClient } from '../src/meta.js';
import { decryptSecret, encryptSecret } from '../src/token-crypto.js';

const encryptionKey = '1'.repeat(64);
const config = { metaGraphVersion: 'v26.0', tokenEncryptionKey: encryptionKey };

test('token encryption round-trips without exposing plaintext', () => {
  const encrypted = encryptSecret('page-token-secret', encryptionKey);
  assert.equal(encrypted.includes('page-token-secret'), false);
  assert.equal(decryptSecret(encrypted, encryptionKey), 'page-token-secret');
});

test('first Instagram webhook reuses the connected Page token', async () => {
  const page = { page_id: '102594497956428', token_ciphertext: 'encrypted-token', scopes: ['page_access_token'] };
  let saved;
  const store = {
    metaConnectionByAccount: async () => null,
    primaryMetaPageConnection: async () => page,
    upsertMetaConnection: async (row) => { saved = row; return { id: 'ig-connection', ...row }; },
    audit: async () => {}
  };
  const client = new MetaClient({ metaGraphVersion: 'v26.0' }, store);
  const result = await client.ensureWebhookConnection('178900000000001', 'instagram');
  assert.equal(result.platform, 'instagram');
  assert.equal(saved.page_id, '102594497956428');
  assert.equal(saved.token_ciphertext, 'encrypted-token');
});

test('Page ID and token persist without requiring Page metadata access', async () => {
  const saved = [];
  const store = {
    upsertMetaConnection: async (row) => { saved.push(row); return { id: String(saved.length), ...row }; },
    audit: async () => {}
  };
  const connection = new MetaConnection(config, store);
  connection.subscribePage = async () => { throw new Error('pages_manage_metadata unavailable'); };

  const result = await connection.connectPageToken({ token: 'page-token', pageId: '102594497956428', pageName: 'MaidThis Cleaning' });
  assert.equal(result.connections.length, 1);
  assert.deepEqual(saved.map((row) => row.platform), ['messenger']);
  assert.equal(saved[0].page_id, '102594497956428');
  assert.equal(saved[0].account_name, 'MaidThis Cleaning');
  assert.equal(decryptSecret(saved[0].token_ciphertext, encryptionKey), 'page-token');
  assert.match(result.subscriptionWarning, /saved/);
});
