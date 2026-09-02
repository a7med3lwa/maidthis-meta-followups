# MaidThis Standalone Meta OAuth App Setup

This version works like HighLevel's connection screen: an administrator clicks **Connect Facebook & Instagram**, signs in to Facebook on Meta's website, approves the requested access, chooses the MaidThis Page and linked Instagram professional account, and returns to the MaidThis dashboard.

The application does not require a HighLevel API token. It does require your own Meta developer app, App ID, App Secret, webhook configuration, and the Meta permissions applicable to the features you use.

## What the app handles automatically

- Facebook OAuth login and CSRF protection
- Short-lived to long-lived user token exchange
- Retrieval of Pages the signed-in user can manage
- Discovery of Instagram professional accounts linked to those Pages
- A Page/Instagram account-selection screen
- Page webhook subscription
- AES-256-GCM encryption before Page tokens enter Supabase
- Per-account conversation import, outbound sending, and disconnect controls
- Facebook/Instagram webhook signature validation
- Customer-reply cancellation, template-stage detection, and duplicate protection
- Privacy, terms, and Meta data-deletion endpoints
- Dark-first dashboard with a remembered light/dark toggle

## What Meta still controls

The login screen does not bypass Meta permissions. The Facebook profile authorizing the connection must have sufficient access to the Page. For messages from real customers in production, Meta may require the app to be Live, Business Verified, and approved for Advanced Access. The 24-hour automated messaging window also continues to apply.

## 1. Update Supabase

1. Open [the MaidThis Supabase SQL Editor](https://supabase.com/dashboard/project/eymobfdkrgluiujbctly/sql/new).
2. Open `sql/003_meta_oauth.sql` from the full project package.
3. Paste the complete SQL into the editor.
4. Click **Run**.
5. Confirm the result says success.

This creates `meta_connections`. Page tokens are encrypted by the application before they reach this table.

## 2. Upload the Railway upgrade to GitHub

Your GitHub repository uses a flat root layout. Extract `MaidThis-Meta-OAuth-Railway-Upgrade.zip`, then upload and replace these files in the repository root:

- `config.js`
- `dashboard.js`
- `meta.js`
- `meta-oauth.js`
- `server.js`
- `supabase.js`
- `token-crypto.js`
- `Dockerfile`

Also upload `003_meta_oauth.sql` for version control. Commit the files and allow Railway to redeploy.

Do not enable OAuth variables until the files and SQL migration are in place.

## 3. Configure the Meta developer app

Open [Meta for Developers](https://developers.facebook.com/apps/), then open the app you created for MaidThis.

### App details

In **App settings > Basic**, configure:

| Field | Value |
|---|---|
| App domain | `maidthis-meta-followups-production.up.railway.app` |
| Privacy Policy URL | `https://maidthis-meta-followups-production.up.railway.app/privacy` |
| Terms of Service URL | `https://maidthis-meta-followups-production.up.railway.app/terms` |
| User data deletion URL | `https://maidthis-meta-followups-production.up.railway.app/data-deletion` |
| Category | Business and Pages, or the closest business category shown |

Save the changes. Copy the **App ID**. Click **Show** beside App Secret, authenticate, and copy the secret. Put both only in Railway Variables.

### Facebook Login redirect

Open the app's **Facebook Login** or **Facebook Login for Business** settings. Add this exact Valid OAuth Redirect URI:

`https://maidthis-meta-followups-production.up.railway.app/oauth/meta/callback`

Enable:

- Client OAuth Login
- Web OAuth Login
- Enforce HTTPS

Save the settings. The URI must match exactly, including `/oauth/meta/callback` and with no trailing slash.

### Messenger and Instagram use cases

The app should include **Engage with customers on Messenger from Meta**. Add or configure the Instagram messaging/API use case if Meta shows it separately.

The OAuth flow requests only:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_metadata`
- `pages_messaging`
- `instagram_basic`
- `instagram_manage_messages`

### Webhooks

In the Meta app's webhook configuration, add:

- Callback URL: `https://maidthis-meta-followups-production.up.railway.app/webhooks/meta`
- Verify token: the exact `META_VERIFY_TOKEN` you will add to Railway

For the **Page** object, subscribe to the message-related fields Meta makes available, including:

- `messages`
- `messaging_postbacks`
- `messaging_referrals`

For the **Instagram** object, subscribe to:

- `messages`

The application automatically calls the Page `subscribed_apps` endpoint after you select an account, but the app-level webhook callback and fields must first exist in the Meta dashboard.

## 4. Add Railway variables

Open [Railway](https://railway.app/dashboard), choose the MaidThis project, click the deployed service card, and open the **Variables** tab.

Add or replace:

```dotenv
MESSAGING_PROVIDER=meta_oauth
META_APP_ID=PASTE_META_APP_ID
META_APP_SECRET=PASTE_META_APP_SECRET
META_VERIFY_TOKEN=CREATE_A_PRIVATE_RANDOM_VALUE
META_GRAPH_VERSION=v23.0
TOKEN_ENCRYPTION_KEY=CREATE_A_64_CHARACTER_HEX_VALUE
PRIVACY_CONTACT_EMAIL=YOUR_REAL_CONTACT_EMAIL
```

Keep all existing working Supabase, admin-password, scheduler, and public-URL variables.

Generate the two random values safely from the Supabase SQL Editor:

```sql
select encode(gen_random_bytes(32), 'hex') as random_value;
```

Run it twice. Use one result for `META_VERIFY_TOKEN` and the other for `TOKEN_ENCRYPTION_KEY`.

Do not paste App Secret, encryption key, Page tokens, or the Supabase secret key into GitHub or chat.

## 5. Verify the deployment

After Railway reports a successful deployment, open:

- Health: <https://maidthis-meta-followups-production.up.railway.app/healthz>
- Dashboard: <https://maidthis-meta-followups-production.up.railway.app/admin>
- Privacy: <https://maidthis-meta-followups-production.up.railway.app/privacy>
- Terms: <https://maidthis-meta-followups-production.up.railway.app/terms>
- Data deletion: <https://maidthis-meta-followups-production.up.railway.app/data-deletion>

The health page must show `{"ok":true}`. The dashboard should open in dark mode and show **Meta OAuth** in the upper-right corner.

## 6. Connect MaidThis through the new login

1. Keep **Global sending = Paused** and **Delivery mode = Review required**.
2. Click **Connect Facebook & Instagram**.
3. Meta opens its own login/authorization page.
4. Sign in with the Facebook profile that can manage the MaidThis Page.
5. Approve the requested permissions.
6. Select only the MaidThis Facebook Page and corresponding Instagram account.
7. Click **Connect selected accounts**.
8. Confirm both appear under **Connected inboxes**.
9. Click **Import history** separately on each connected inbox.

If Meta returns many Pages, the account-selection screen keeps them separate. Selecting a Page does not automatically connect unrelated Pages.

## 7. Development testing and production access

Initially keep the Meta app in Development mode and test with Facebook/Instagram accounts that have a role on the app. Confirm:

- OAuth returns to the account chooser.
- Messenger and Instagram both appear.
- Incoming messages reach the dashboard.
- Manual follow-up templates advance the detected stage.
- Customer replies cancel pending follow-ups.
- Text and image messages send only in review mode.

For real ad leads who are not app-role users, request the required Advanced Access permissions and move the app Live. Use `META-APP-REVIEW.md` for the review descriptions and recording checklist.

## 8. Safe rollout

1. Import history with sending paused.
2. Compare at least 20 leads with the original inbox.
3. Keep review mode for several days.
4. Test the skeleton and Mr. Bean media stages.
5. Confirm booked, paused, opted-out, and outside-window leads never send.
6. Enable automatic mode only after the decisions remain correct.

