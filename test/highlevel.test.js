import assert from 'node:assert/strict';
import test from 'node:test';
import { HighLevelClient } from '../src/highlevel.js';

const config = {
  highlevelToken: 'test-token',
  highlevelLocationId: 'location-1',
  highlevelApiVersion: 'v3'
};

test('sendPart maps Instagram and Messenger to HighLevel channel types', async () => {
  const client = new HighLevelClient(config, {});
  const calls = [];
  client.request = async (path, options) => { calls.push({ path, options }); return { messageId: `m-${calls.length}` }; };

  await client.sendPart({ platform: 'instagram', platform_user_id: 'contact-ig' }, { message: 'hello' });
  await client.sendPart({ platform: 'messenger', platform_user_id: 'contact-fb' }, { attachments: ['https://example.com/a.jpg'] });

  assert.equal(calls[0].path, '/conversations/messages');
  assert.deepEqual(calls[0].options.body, { type: 'IG', contactId: 'contact-ig', status: 'pending', message: 'hello' });
  assert.deepEqual(calls[1].options.body, { type: 'FB', contactId: 'contact-fb', status: 'pending', attachments: ['https://example.com/a.jpg'] });
});

test('messages follows HighLevel message pagination', async () => {
  const client = new HighLevelClient(config, {});
  let page = 0;
  client.request = async () => {
    page += 1;
    return page === 1
      ? { messages: { messages: [{ id: 'one' }], nextPage: true, lastMessageId: 'one' } }
      : { messages: { messages: [{ id: 'two' }], nextPage: false, lastMessageId: 'two' } };
  };

  assert.deepEqual((await client.messages('conversation-1', 10)).map((message) => message.id), ['one', 'two']);
});
