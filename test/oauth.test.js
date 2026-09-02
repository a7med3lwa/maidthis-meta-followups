import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaOAuth } from '../src/meta-oauth.js';
import { decryptSecret, encryptSecret, signedState, verifySignedState } from '../src/token-crypto.js';

const encryptionKey = '1'.repeat(64);
const config = {
  publicBaseUrl: 'https://followups.example.com',
  metaAppId: '12345',
  metaAppSecret: 'app-secret-long-enough',
  metaGraphVersion: 'v23.0',
  metaOAuthScopes: ['pages_show_list', 'pages_messaging'],
  tokenEncryptionKey: encryptionKey
};

test('token encryption round-trips without exposing plaintext', () => {
  const encrypted = encryptSecret('page-token-secret', encryptionKey);
  assert.equal(encrypted.includes('page-token-secret'), false);
  assert.equal(decryptSecret(encrypted, encryptionKey), 'page-token-secret');
});

test('signed OAuth state validates and rejects tampering', () => {
  const state = signedState(config.metaAppSecret);
  assert.equal(verifySignedState(state, config.metaAppSecret), true);
  assert.equal(verifySignedState(`${state}x`, config.metaAppSecret), false);
});

test('authorization URL uses the exact callback and requested scopes', () => {
  const oauth = new MetaOAuth(config, {});
  const url = new URL(oauth.authorizeUrl());
  assert.equal(url.searchParams.get('client_id'), '12345');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://followups.example.com/oauth/meta/callback');
  assert.equal(url.searchParams.get('scope'), 'pages_show_list,pages_messaging');
  assert.ok(url.searchParams.get('state'));
});

test('selected Page and Instagram account are encrypted and persisted', async () => {
  const saved = [];
  const store = {
    upsertMetaConnection: async (row) => { saved.push(row); return { id: String(saved.length), ...row }; },
    audit: async () => {}
  };
  const oauth = new MetaOAuth(config, store);
  oauth.subscribePage = async () => ({ success: true });
  const bundle = encryptSecret(JSON.stringify({
    exp: Date.now() + 60_000,
    user: { id: 'u1', name: 'Admin' },
    pages: [{ id: 'p1', name: 'MaidThis', access_token: 'page-token', instagram: { id: 'ig1', name: 'MaidThis IG', username: 'maidthis' } }]
  }), encryptionKey);

  await oauth.connectSelected(bundle, ['messenger:p1', 'instagram:ig1']);
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map((row) => row.platform), ['messenger', 'instagram']);
  assert.equal(decryptSecret(saved[0].token_ciphertext, encryptionKey), 'page-token');
  assert.equal(saved[0].connected_by_user_id, 'u1');
});

