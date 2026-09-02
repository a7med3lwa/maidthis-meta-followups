const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const optionalJson = (name, fallback = {}) => {
  if (!process.env[name]) return fallback;
  try { return JSON.parse(process.env[name]); }
  catch { throw new Error(`${name} must contain valid JSON`); }
};

export function loadConfig({ validate = true } = {}) {
  const get = validate ? required : (name) => process.env[name] || '';
  const provider = process.env.MESSAGING_PROVIDER || 'meta';
  const directMeta = provider === 'meta';
  const oauthMeta = provider === 'meta_oauth';
  return {
    port: Number(process.env.PORT || 3000),
    publicBaseUrl: get('PUBLIC_BASE_URL').replace(/\/$/, ''),
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPassword: get('ADMIN_PASSWORD'),
    adminFormToken: get('ADMIN_FORM_TOKEN'),
    internalToken: get('INTERNAL_TOKEN'),
    messagingProvider: provider,
    supabaseUrl: get('SUPABASE_URL').replace(/\/$/, ''),
    supabaseKey: process.env.SUPABASE_SECRET_KEY || get('SUPABASE_SERVICE_ROLE_KEY'),
    metaVerifyToken: directMeta || oauthMeta ? get('META_VERIFY_TOKEN') : (process.env.META_VERIFY_TOKEN || ''),
    metaAppId: oauthMeta ? get('META_APP_ID') : (process.env.META_APP_ID || ''),
    metaAppSecret: directMeta || oauthMeta ? get('META_APP_SECRET') : (process.env.META_APP_SECRET || ''),
    metaGraphVersion: process.env.META_GRAPH_VERSION || 'v23.0',
    metaOAuthScopes: (process.env.META_OAUTH_SCOPES || 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages').split(',').map((item) => item.trim()).filter(Boolean),
    tokenEncryptionKey: oauthMeta ? get('TOKEN_ENCRYPTION_KEY') : (process.env.TOKEN_ENCRYPTION_KEY || ''),
    privacyContactEmail: oauthMeta ? get('PRIVACY_CONTACT_EMAIL') : (process.env.PRIVACY_CONTACT_EMAIL || 'privacy@example.com'),
    defaultMetaToken: directMeta ? get('META_PAGE_ACCESS_TOKEN') : (process.env.META_PAGE_ACCESS_TOKEN || ''),
    metaTokens: optionalJson('META_ACCESS_TOKENS_JSON'),
    businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '',
    platform: process.env.META_PLATFORM || 'messenger',
    highlevelToken: provider === 'highlevel' ? get('HIGHLEVEL_API_TOKEN') : (process.env.HIGHLEVEL_API_TOKEN || ''),
    highlevelLocationId: provider === 'highlevel' ? get('HIGHLEVEL_LOCATION_ID') : (process.env.HIGHLEVEL_LOCATION_ID || ''),
    highlevelApiVersion: process.env.HIGHLEVEL_API_VERSION || 'v3',
    highlevelPollLimit: Math.max(10, Number(process.env.HIGHLEVEL_POLL_LIMIT || 100)),
    internalSchedulerEnabled: (process.env.INTERNAL_SCHEDULER_ENABLED || 'true') === 'true',
    tickIntervalMinutes: Math.max(1, Number(process.env.TICK_INTERVAL_MINUTES || 5)),
    backfillConversationLimit: Number(process.env.BACKFILL_CONVERSATION_LIMIT || 250),
    backfillMessagesPerConversation: Number(process.env.BACKFILL_MESSAGES_PER_CONVERSATION || 100)
  };
}
