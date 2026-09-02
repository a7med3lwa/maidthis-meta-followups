const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function loadConfig({ validate = true } = {}) {
  const get = validate ? required : (name) => process.env[name] || '';
  const provider = process.env.MESSAGING_PROVIDER || 'meta_manual';
  if (validate && provider !== 'meta_manual') throw new Error('MESSAGING_PROVIDER must be meta_manual in this release');
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
    metaVerifyToken: get('META_VERIFY_TOKEN'),
    metaAppSecret: get('META_APP_SECRET'),
    metaGraphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    tokenEncryptionKey: get('TOKEN_ENCRYPTION_KEY'),
    privacyContactEmail: get('PRIVACY_CONTACT_EMAIL'),
    internalSchedulerEnabled: (process.env.INTERNAL_SCHEDULER_ENABLED || 'true') === 'true',
    tickIntervalMinutes: Math.max(1, Number(process.env.TICK_INTERVAL_MINUTES || 5)),
    backfillConversationLimit: Number(process.env.BACKFILL_CONVERSATION_LIMIT || 250),
    backfillMessagesPerConversation: Number(process.env.BACKFILL_MESSAGES_PER_CONVERSATION || 100)
  };
}
