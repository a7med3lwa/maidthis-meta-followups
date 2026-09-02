import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../src/supabase.js';

test('new sb_secret keys use apikey and are not treated as bearer JWTs', () => {
  const store = new SupabaseStore({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'sb_secret_example' });
  assert.equal(store.headers.apikey, 'sb_secret_example');
  assert.equal(store.headers.authorization, undefined);
});

test('legacy service_role JWT remains backward compatible', () => {
  const store = new SupabaseStore({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'eyJlegacy' });
  assert.equal(store.headers.authorization, 'Bearer eyJlegacy');
});
