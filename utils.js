import crypto from 'node:crypto';

export const normalizeText = (value = '') => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const timingSafeEqual = (a = '', b = '') => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return timingSafeEqual(signatureHeader, expected);
}

export const latestDate = (...values) => {
  const valid = values.filter(Boolean).map((v) => new Date(v)).filter((d) => !Number.isNaN(d.valueOf()));
  return valid.length ? new Date(Math.max(...valid.map(Number))) : null;
};

export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}

export const localDateKey = (date, timeZone) => {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
};

const minutesFromTime = (time) => {
  const [h, m] = String(time).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

export function inBusinessWindow(date, settings) {
  const p = zonedParts(date, settings.timezone);
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= minutesFromTime(settings.business_start) && minutes < minutesFromTime(settings.business_end);
}

export function nextBusinessInstant(from, settings) {
  let cursor = new Date(from);
  cursor.setUTCSeconds(0, 0);
  for (let i = 0; i < 8 * 24 * 4; i += 1) {
    if (inBusinessWindow(cursor, settings)) return cursor;
    cursor = new Date(cursor.getTime() + 15 * 60_000);
  }
  throw new Error('Unable to find a business-hours slot in the next 8 days');
}

export const renderTemplate = (body, contact) => body.replaceAll('{{first_name}}', contact.first_name?.trim() || 'there');

export function isStopMessage(text = '') {
  const n = normalizeText(text);
  return /^(stop|unsubscribe|remove me|do not contact|dont contact|please stop|please dont message me|(?:i am |im )?(?:not|no longer) interested)( please)?$/.test(n);
}
