import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTemplateStage } from '../src/template-matcher.js';

const templates = [
  { stage: 2, enabled: true, match_phrase: 'would you still like to get your home cleaning scheduled' },
  { stage: 4, enabled: true, match_phrase: 'would you like me to hold a spot for you or should i release it' },
  { stage: 7, enabled: true, match_phrase: '__name_ping__' }
];

test('matches a personalized known follow-up among punctuation and emoji', () => {
  assert.equal(detectTemplateStage('Hi Cindy, checking in 😊 Would you still like to get your home cleaning scheduled?', templates, { first_name: 'Cindy' }), 2);
});

test('matches the highest known stage, not merely the last ordinary message', () => {
  assert.equal(detectTemplateStage('Hi Cindy, would you like me to hold a spot for you, or should I release it?', templates, { first_name: 'Cindy' }), 4);
  assert.equal(detectTemplateStage('Got it. What day works?', templates, { first_name: 'Cindy' }), null);
});

test('matches name-only stage only against known first name', () => {
  assert.equal(detectTemplateStage('Cindy?', templates, { first_name: 'Cindy' }), 7);
  assert.equal(detectTemplateStage('Hello?', templates, { first_name: 'Cindy' }), null);
});
