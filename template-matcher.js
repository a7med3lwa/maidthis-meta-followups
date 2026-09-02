import { normalizeText } from './utils.js';

export function detectTemplateStage(text, templates, contact = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  let best = null;
  for (const template of templates) {
    if (!template.enabled) continue;
    if (template.match_phrase === '__name_ping__') {
      const first = normalizeText(contact.first_name || '');
      if (first && normalized === first) best = Math.max(best || 0, template.stage);
      continue;
    }
    if (normalized.includes(normalizeText(template.match_phrase))) {
      best = Math.max(best || 0, template.stage);
    }
  }
  return best;
}
