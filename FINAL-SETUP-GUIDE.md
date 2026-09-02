# MaidThis Meta Follow-ups v3: Final Setup Guide

This is the simplified final build. It keeps the dark Railway dashboard and removes the separate Facebook Login flow that caused the incompatible-use-case problem.

The connection is now:

1. Meta shows its own Page-selection popup inside the Messenger API setup.
2. You choose the MaidThis Facebook Page there.
3. Meta generates a Page access token.
4. You paste that token once into the MaidThis dashboard.
5. The app verifies it, encrypts it, subscribes the webhook, and finds the linked Instagram professional account automatically.

There is no Facebook Login use case, OAuth callback URL, login button, or HighLevel token in this version.

## Read this first: the one Meta limitation code cannot remove

The simpler token connection removes the confusing OAuth setup. It does **not** remove Meta's permission system.

- You can test an unpublished app with the Meta accounts and Pages that Meta allows for your app roles.
- To message real advertising leads who are not app-role testers, Meta may require the app to be Live and the messaging permissions to receive Advanced Access or App Review.
- An independent app cannot copy GoHighLevel's already-approved status. GoHighLevel's login looks easy because GoHighLevel completed Meta's platform approval for its own app.
- If Meta does not show the MaidThis Page when you generate a Page token, the Railway code cannot force the Page to appear. That means the Facebook profile does not have the Page task/access Meta requires for this app.

This guide gives you an early checkpoint. Do that checkpoint before spending time on anything else.

## Final project contents

The ZIP has only the files required by Railway:

```text
maidthis-meta-followups-v3-simple/
  Dockerfile
  package.json
  RAILWAY-VARIABLES.txt
  GENERATE-SECRETS.html
  FINAL-SETUP-GUIDE.md
  README.md
  public/
  sql/
  src/
  test/
```

Old `deploy`, `n8n`, HighLevel setup files, old ZIPs, and old duplicate Dockerfiles are intentionally excluded.

## Phase 0: rotate the exposed secrets

Several live secret values were pasted into chat and may also be in deployment history. Treat them as exposed.

Do these rotations before production:

1. **Supabase:** open the Supabase dashboard, select the MaidThis project, open **Project Settings > API Keys**, create a new server secret key, update Railway, then revoke the old server/service-role key.
2. **Meta:** open the Meta app, go to **App settings > Basic**, reset the App Secret, then update `META_APP_SECRET` in Railway.
3. Open `GENERATE-SECRETS.html` from the ZIP on your own computer. Click **Regenerate all**, then copy the five generated lines.
4. Use the generated values for `ADMIN_PASSWORD`, `ADMIN_FORM_TOKEN`, `INTERNAL_TOKEN`, `META_VERIFY_TOKEN`, and `TOKEN_ENCRYPTION_KEY`.

Do not put any live secret in GitHub, `.env.example`, a screenshot, or a support message. `PRIVACY_CONTACT_EMAIL` and `PUBLIC_BASE_URL` are not secrets.

Important: once a real Page token has been connected, changing `TOKEN_ENCRYPTION_KEY` makes the stored token unreadable. If you change it later, disconnect and reconnect the Page with a new Page token.

## Phase 1: replace the GitHub repository cleanly in one upload

The easiest reliable method on Windows is GitHub Desktop. GitHub's browser uploader is poor at replacing a project with nested folders.

### 1. Download and extract

1. Download the final ZIP.
2. Right-click it and choose **Extract All**.
3. Open the extracted folder.
4. Confirm you immediately see `Dockerfile`, `package.json`, `src`, `public`, and `sql`.

Do not upload the ZIP itself. Do not leave all files inside an extra wrapper folder in the repository.

### 2. Clone the existing repository

1. Install and open [GitHub Desktop](https://desktop.github.com/).
2. Choose **File > Clone repository**.
3. Select the current `maidthis-meta-followups` repository.
4. Click **Clone**.
5. In GitHub Desktop choose **Repository > Show in Explorer**.

### 3. Replace the old files

1. In the cloned repository folder, delete the old visible project files and folders. Do not delete the hidden `.git` folder.
2. Copy everything inside the extracted `maidthis-meta-followups-v3-simple` folder into the cloned repository folder.
3. Return to GitHub Desktop.
4. Confirm the changes show deletion of the old `deploy`, `n8n`, and old setup files, plus the new v3 files.
5. Enter summary: `Replace project with simple Meta Page connection`.
6. Click **Commit to main**.
7. Click **Push origin**.

### 4. Verify the GitHub root

Open the repository on GitHub. The top level must directly show:

- `Dockerfile`
- `package.json`
- `public`
- `sql`
- `src`
- `test`

If the top level shows only one folder containing those files, the upload is one level too deep.

## Phase 2: prepare Supabase

Open [Supabase](https://supabase.com/dashboard), select project `eymobfdkrgluiujbctly`, then open **SQL Editor**.

Run these three files in this order:

1. `sql/001_schema.sql`
2. `sql/002_seed_templates.sql`
3. `sql/003_meta_connections.sql`

For each file:

1. Open the file from the extracted project.
2. Copy all of its contents.
3. In Supabase click **New query**.
4. Paste the SQL.
5. Click **Run**.
6. Confirm the result says success before moving to the next file.

Running them again is safe because the schema uses `if not exists` and the seed uses upserts.

Then create a new Supabase server secret:

1. Open **Project Settings > API Keys**.
2. Create or copy a new `sb_secret_...` server key.
3. Do not use the `sb_publishable_...` key. The backend needs the server secret.

## Phase 3: set Railway correctly

Open [Railway](https://railway.app/dashboard), select the MaidThis project, then click the `maidthis-meta-followups` service card.

### 1. Confirm the build source

1. Open **Settings**.
2. Under **Source**, confirm the correct GitHub repository and `main` branch are selected.
3. Leave **Root Directory** blank or `/`.
4. Under **Build**, clear any old Dockerfile path that points to `deploy/Dockerfile`.
5. Railway should use the root `Dockerfile`.

### 2. Add the variables

1. Click the **Variables** tab at the top of the service page. It is beside tabs such as Deployments, Metrics, and Settings.
2. Click **Raw Editor**, **Add Variables**, or **New Variable**. Railway changes the button label occasionally.
3. Open `RAILWAY-VARIABLES.txt` from the final project.
4. Replace every `PASTE_...` placeholder with the new real value.
5. Paste the complete block into Railway.
6. Save or deploy the changes.

The final variables are:

| Variable | What to enter |
|---|---|
| `PUBLIC_BASE_URL` | `https://maidthis-meta-followups-production.up.railway.app` |
| `MESSAGING_PROVIDER` | `meta_manual` |
| `SUPABASE_URL` | `https://eymobfdkrgluiujbctly.supabase.co` |
| `SUPABASE_SECRET_KEY` | A newly rotated `sb_secret_...` server key |
| `ADMIN_USER` | `admin`, or another username |
| `ADMIN_PASSWORD` | New value from `GENERATE-SECRETS.html` |
| `ADMIN_FORM_TOKEN` | New value from `GENERATE-SECRETS.html` |
| `INTERNAL_TOKEN` | New value from `GENERATE-SECRETS.html` |
| `INTERNAL_SCHEDULER_ENABLED` | `true` |
| `TICK_INTERVAL_MINUTES` | `5` |
| `META_APP_SECRET` | The rotated App Secret from Meta |
| `META_VERIFY_TOKEN` | New value from `GENERATE-SECRETS.html` |
| `META_GRAPH_VERSION` | `v26.0` |
| `TOKEN_ENCRYPTION_KEY` | The 64-character value from `GENERATE-SECRETS.html` |
| `PRIVACY_CONTACT_EMAIL` | A real email you monitor |
| `BACKFILL_CONVERSATION_LIMIT` | `250` |
| `BACKFILL_MESSAGES_PER_CONVERSATION` | `100` |

Do not add the following old variables:

- `HIGHLEVEL_API_TOKEN`
- `HIGHLEVEL_LOCATION_ID`
- `META_APP_ID`
- `META_OAUTH_SCOPES`
- `META_PAGE_ACCESS_TOKEN`
- `META_BUSINESS_ACCOUNT_ID`
- `META_PLATFORM`
- `N8N_ENCRYPTION_KEY`

The new dashboard stores the Page token encrypted after you submit it. The Page token does not belong in Railway variables.

### 3. Confirm the port and domain

1. Wait for the deployment to finish.
2. Open **Deploy Logs**.
3. Look for `MaidThis follow-up service listening on :8080` or another port.
4. Open **Settings > Networking > Public Networking**.
5. Make sure the domain target port is the same port shown in the deploy log. Your current working service used port `8080`.
6. Open [the health check](https://maidthis-meta-followups-production.up.railway.app/healthz).

Correct response:

```json
{"ok":true}
```

Then open [the dashboard](https://maidthis-meta-followups-production.up.railway.app/admin) and sign in with `ADMIN_USER` and `ADMIN_PASSWORD`.

## Phase 4: do the Meta checkpoint first

Use the Meta app that has the **Engage with customers on Messenger from Meta** use case. Do not add the separate **Authenticate and request data from users with Facebook Login** use case. Meta correctly reports that those use cases cannot be combined in that app, and v3 does not need the separate login use case.

Open [Meta for Developers](https://developers.facebook.com/apps/), choose the app, and open the Messenger use case's **Customize** or **API Setup** page.

Inside that Messenger use case, confirm the permissions/settings available for the app include the current equivalents of:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_metadata`
- `pages_messaging`
- `instagram_basic`, if Instagram is needed
- `instagram_manage_messages`, if Instagram is needed

Add the Instagram permissions inside the Messenger use case's permission customization when Meta offers them. Do not create a separate Facebook Login use case and do not put these names into a Railway OAuth-scopes variable. This release has no OAuth-scopes variable.

Find **Generate access tokens**.

1. Click **Connect** or **Add or remove Pages**.
2. Meta opens its own Facebook login/permission popup.
3. Log in as your personal Facebook profile that manages the MaidThis Page.
4. If Meta shows **Edit access**, open it and select the MaidThis Page.
5. Enable every requested Page and messaging permission for that Page.
6. Finish with **Continue**, **Save**, or **Got it**.

### Stop/go checkpoint

- **GO:** MaidThis appears in the Page list under **Generate access tokens**. Continue to Phase 5.
- **STOP:** MaidThis does not appear. Do not continue configuring the independent app. Meta is not granting this personal profile the Page task required to generate the token.

If the Page is missing, check only these items:

1. Your personal Facebook profile is an Administrator or Developer of this Meta app.
2. In the Facebook Page's settings, your profile has Facebook access or task access that includes messages/community activity.
3. In Meta Business Settings, the MaidThis Page is assigned to your profile with the required Page tasks.
4. The Instagram account is Professional, not Personal.
5. The Instagram professional account is linked to the MaidThis Facebook Page.
6. On Instagram, open **Settings and activity > Messages and story replies > Message controls > Connected tools** and enable **Allow access to messages**.

If the Page remains missing after those checks, the only solutions are:

- use the already-connected GoHighLevel Messenger/Instagram integration and its native workflows, or
- have a person with the required Page/business access grant it, or
- complete the Meta access/review route for the independent app.

There is no code, token format, Railway variable, or different login screen that bypasses this Meta check.

## Phase 5: configure the Meta webhook

Still in the Messenger use case's **Customize** or **API Setup** page, find **Webhooks**. Depending on Meta's current layout, it may be a Webhooks section inside the Messenger use case or a **Webhooks** item in the left menu.

Enter:

```text
Callback URL: https://maidthis-meta-followups-production.up.railway.app/webhooks/meta
Verify token: the exact META_VERIFY_TOKEN value currently saved in Railway
```

Click **Verify and save**.

If verification fails:

1. Confirm `/healthz` returns `{"ok":true}`.
2. Confirm the callback ends exactly with `/webhooks/meta`.
3. Confirm there is no extra space before or after the verify token in Meta or Railway.
4. Confirm the latest Railway deployment is active.
5. Confirm `MESSAGING_PROVIDER=meta_manual`.

For the **Page** object, subscribe to:

- `messages`
- `messaging_postbacks`
- `messaging_referrals`

The `messages` subscription includes the message events the app uses, including outbound echo events where Meta supplies them. Do not add `message_echoes` as a separate subscription field if Meta does not list it.

If Meta shows an **Instagram** webhook object, subscribe to its `messages` field as well. The exact optional Instagram event list can vary by Meta UI version.

## Phase 6: generate and connect the Page token

Return to **Generate access tokens** in the Messenger API setup.

1. Find the MaidThis Page.
2. Click **Generate token**.
3. Meta may ask you to confirm your Facebook password or acknowledge a warning.
4. Copy the complete generated Page access token.
5. Do not put it in GitHub or Railway.
6. Immediately open [the MaidThis dashboard](https://maidthis-meta-followups-production.up.railway.app/admin).
7. In **Connections**, paste the token into **Page access token from Meta**.
8. Click **Connect Meta Page**.

The app performs these steps automatically:

- asks Meta which Page owns the token;
- rejects a token that is not a valid Page token;
- subscribes the Page to the app's webhook;
- encrypts the token with AES-256-GCM;
- stores only encrypted token data in Supabase;
- creates the Facebook Messenger connection;
- discovers and creates the linked Instagram connection when Meta returns it.

Success looks like one Facebook connection card and, if Instagram is linked and permissioned, one Instagram connection card.

If only Facebook appears, the Facebook token worked. Recheck the Instagram Professional-account link, the Instagram permission in the Messenger use case, and **Allow access to messages** in Instagram.

## Phase 7: test without risking leads

Leave these dashboard settings unchanged at first:

```text
Global sending: Paused
Delivery mode: Review required
Follow-ups per day: 2
Minimum gap: 240 minutes
Silence before queueing: 180 minutes
```

### Test incoming Facebook Messenger

1. Use a different Facebook account from the one that owns/administers the app.
2. Send a message to the MaidThis Page.
3. Wait up to one minute.
4. Refresh the dashboard.
5. Confirm the lead appears under **Recent leads**.

### Test incoming Instagram

1. Use a different Instagram account.
2. Send a DM to the linked MaidThis Instagram professional account.
3. Refresh the dashboard.
4. Confirm an Instagram lead appears.

### Test history import

1. Keep sending paused.
2. On the Facebook connection card click **Import history**.
3. Wait for the completion notice.
4. Repeat for Instagram.
5. Compare at least 20 imported conversations against the real inbox.
6. Specifically verify stages containing the skeleton and Mr. Bean messages.

### Test the stage logic

For one internal test conversation:

1. Send Follow-up 1 manually from the Page inbox.
2. Exchange a few ordinary messages.
3. Stop replying.
4. Confirm the app identifies the current stage as 1 and queues stage 2, not stage 1 again.
5. Send a new customer reply and confirm any pending queue item is cancelled.

## Phase 8: safe rollout

1. Keep **Global sending = Paused** until imports and test webhooks are correct.
2. Keep **Review required**.
3. Review at least 20 conversations and their proposed next stage.
4. Set **Global sending = Enabled** while leaving **Review required** on.
5. Use **Send now** only on internal/test leads first.
6. Run in review mode for several days.
7. Switch to automatic mode only after the queue has made consistently correct decisions.

Emergency stop: set **Global sending** back to **Paused**. This blocks automated sends immediately while preserving history and review items.

## Meta's 24-hour rule

This application deliberately checks the standard messaging window before every send. If the customer has not interacted within the allowed window, the queue becomes `blocked_policy` and the message is not sent.

The original five-day sequence cannot be fully automated through ordinary Messenger or Instagram Send APIs unless the recipient and Page qualify for a Meta-approved out-of-window messaging product. A browser robot is not a safe workaround.

This means a two-follow-up day can work only when both messages remain inside the valid Meta window. Later stages wait for a new eligible customer interaction or an approved Meta product.

## Development mode, Live mode, and App Review

Use Development mode for the first tests. If Meta allows only app-role/test accounts and blocks real leads, the code is working as designed and Meta is enforcing app access.

For real public leads, Meta can require:

- the app to be switched to Live;
- valid privacy-policy and data-deletion URLs;
- Advanced Access or App Review for messaging permissions;
- business verification or verification of the organization that owns the app.

The project already exposes:

```text
Privacy policy: https://maidthis-meta-followups-production.up.railway.app/privacy
Terms: https://maidthis-meta-followups-production.up.railway.app/terms
Data deletion: https://maidthis-meta-followups-production.up.railway.app/data-deletion
```

Official references:

- [Meta Messenger app setup](https://developers.facebook.com/documentation/business-messaging/messenger-platform/create-an-app/)
- [Meta Messenger quick start](https://developers.facebook.com/documentation/business-messaging/messenger-platform/getting-started/quick-start/)
- [Meta app publishing](https://developers.facebook.com/documentation/development/release/)
- [Meta Messenger App Review](https://developers.facebook.com/documentation/business-messaging/messenger-platform/app-review/)
- [Instagram messaging App Review](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/app-review/)

## If you refuse Meta review: the production route is GoHighLevel

Your screenshot confirmed that MaidThis Facebook and Instagram are already connected in GoHighLevel and conversations work there. That is the only no-new-Meta-review route available with the access you currently have.

In GoHighLevel:

1. Open the MaidThis sub-account.
2. Go to **Automation > Workflows**.
3. Create one workflow for Facebook and one for Instagram.
4. Use **Customer Replied** with the appropriate Facebook or Instagram reply-channel filter.
5. Use wait steps and the **Messenger**, **Facebook Interactive Messenger**, **Instagram DM**, or **Instagram Interactive Messenger** actions that appear for the channel.
6. Keep every automated send inside Meta's 24-hour window.

Official HighLevel references:

- [Connect Facebook and Instagram Messenger](https://help.gohighlevel.com/support/solutions/articles/155000005068-getting-started-setup-facebook-and-instagram-messenger)
- [Messenger workflow action](https://help.gohighlevel.com/support/solutions/articles/155000003292/)
- [Facebook Interactive Messenger](https://help.gohighlevel.com/support/solutions/articles/155000004661-workflow-action-facebook-interactive-messenger)
- [Instagram Interactive Messenger](https://help.gohighlevel.com/support/solutions/articles/155000004662-workflow-action-instagram-interactive-messenger)

The custom Railway dashboard cannot control GoHighLevel without a GoHighLevel Private Integration/API token or an approved OAuth installation. If you cannot create one and do not want to ask the account owner, that is a hard access boundary.

## Troubleshooting table

| Symptom | Cause | Fix |
|---|---|---|
| Railway says deployment succeeded but the domain fails | Public target port does not match the process port | Match Public Networking target port to the `listening on :PORT` deploy-log line |
| `/healthz` says `Invalid URL` | `PUBLIC_BASE_URL` or Supabase URL is malformed | Paste the values exactly, with `https://` and no extra quotes/spaces |
| Dashboard returns a Supabase relation error | SQL migration missing | Run `001`, `002`, and `003` in order |
| Meta webhook verification fails | Callback or verify-token mismatch | Use the exact callback and the same token in Meta and Railway |
| MaidThis Page is absent in Meta | Personal profile lacks the Page task Meta requires | Check app role and Page task access, otherwise use GHL or obtain access |
| Dashboard says token is not a Page token | Wrong, expired, or copied-incompletely token | Regenerate it under Messenger API Setup for the MaidThis Page |
| Connect reports a Meta permission error | App or profile lacks the required Page messaging permission | Reconnect the Page in Meta and approve all requested Page permissions |
| Facebook connects but Instagram does not | IG not linked, not Professional, missing permission, or Connected Tools off | Link it to the Page, enable messaging access, then reconnect the Page token |
| Test user works but a real lead does not | Development-mode or App Review restriction | Complete Meta's Live/Advanced Access process or use GHL's approved integration |
| Queue says `outside_standard_messaging_window` | More than the permitted window since user interaction | Do not bypass it; wait for a new interaction or use an approved product |
| Dashboard accepts a token but later sends fail | Token expired, revoked, or encryption key changed | Generate a new Page token and reconnect it |

## Final success checklist

- [ ] Exposed Supabase and Meta secrets rotated
- [ ] Old repository replaced, with root `Dockerfile`
- [ ] Three SQL files ran successfully
- [ ] Railway variables use `MESSAGING_PROVIDER=meta_manual`
- [ ] No HighLevel, custom OAuth, or n8n variables remain
- [ ] `/healthz` returns `{"ok":true}`
- [ ] Meta displays MaidThis under Generate access tokens
- [ ] Webhook verified with `/webhooks/meta`
- [ ] Page token connected through the dark dashboard
- [ ] Facebook connection card appears
- [ ] Instagram card appears, if linked and permissioned
- [ ] Test messages arrive from different accounts
- [ ] History checked while sending remains paused
- [ ] Review mode tested before any automatic mode
- [ ] Meta's 24-hour policy block confirmed

Do not enable automatic sending until every checked item above that applies to your account is complete.
