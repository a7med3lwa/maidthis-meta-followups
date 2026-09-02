import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { inBusinessWindow, isStopMessage, nextBusinessInstant, renderTemplate, verifyMetaSignature } from '../src/utils.js';

test('verifies Meta HMAC signatures', () => {
  const body = Buffer.from('{"object":"page"}');
  const secret = 'test-secret';
  const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyMetaSignature(body, sig, secret), true);
  assert.equal(verifyMetaSignature(body, 'sha256=bad', secret), false);
});

test('renders name and detects exact opt-out language', () => {
  assert.equal(renderTemplate('Hi {{first_name}}', { first_name: 'Cindy' }), 'Hi Cindy');
  assert.equal(isStopMessage('Please stop'), true);
  assert.equal(isStopMessage('Do not stop by before noon'), false);
});

test('business-hour calculation uses Los Angeles time', () => {
  const settings = { timezone: 'America/Los_Angeles', business_start: '09:00:00', business_end: '19:00:00' };
  assert.equal(inBusinessWindow(new Date('2026-09-02T17:00:00Z'), settings), true);
  assert.equal(inBusinessWindow(new Date('2026-09-02T04:00:00Z'), settings), false);
  assert.equal(inBusinessWindow(nextBusinessInstant(new Date('2026-09-02T04:00:00Z'), settings), settings), true);
});
