import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaConnection } from '../src/meta-connection.js';
import { decryptSecret, encryptSecret } from '../src/token-crypto.js';

const encryptionKey = '1'.repeat(64);
const config = { metaGraphVersion: 'v26.0', tokenEncryptionKey: encryptionKey };

test('token encryption round-trips without exposing plaintext', () => {
  const encrypted = encryptSecret('page-token-secret', encryptionKey);
  assert.equal(encrypted.includes('page-token-secret'), false);
  assert.equal(decryptSecret(encrypted, encryptionKey), 'page-token-secret');
});

test('Page token discovers and persists Facebook and linked Instagram', async () => {
  const saved = [];
  const store = {
    upsertMetaConnection: async (row) => { saved.push(row); return { id: String(saved.length), ...row }; },
    audit: async () => {}
  };
  const connection = new MetaConnection(config, store);
  connection.request = async () => ({ id: 'p1', name: 'MaidThis', username: 'maidthis-page', instagram_business_account: { id: 'ig1', name: 'MaidThis IG', username: 'maidthis' } });
  connection.subscribePage = async () => ({ success: true });

  const connected = await connection.connectPageToken('page-token');
  assert.equal(connected.length, 2);
  assert.deepEqual(saved.map((row) => row.platform), ['messenger', 'instagram']);
  assert.equal(saved[1].page_id, 'p1');
  assert.equal(decryptSecret(saved[0].token_ciphertext, encryptionKey), 'page-token');
});
