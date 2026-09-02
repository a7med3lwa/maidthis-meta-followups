# MaidThis browser-only setup on Railway

This is the simplest deployment path. You need Supabase, GitHub, Railway, and Meta accounts. You do not need n8n.

## 1. Replace the exposed Supabase key

1. Open the MaidThis Supabase project: https://supabase.com/dashboard/project/eymobfdkrgluiujbctly
2. Open **Settings > API Keys**: https://supabase.com/dashboard/project/eymobfdkrgluiujbctly/settings/api-keys
3. Create a new **Secret key** named `maidthis-followups`. It starts with `sb_secret_`.
4. Copy it directly into your password manager. Do not paste it into chat, email, GitHub, or a document.
5. Since this project is not live yet, deactivate the exposed legacy keys from the same screen.
6. The publishable key is not required by this backend.

## 2. Create the database tables

1. Open the SQL Editor: https://supabase.com/dashboard/project/eymobfdkrgluiujbctly/sql/new
2. Open `sql/001_schema.sql` from the project download, copy everything, paste it into the SQL Editor, and click **Run**.
3. Clear the editor.
4. Open `sql/002_seed_templates.sql`, copy everything, paste it, and click **Run**.
5. Open **Table Editor** and confirm these tables appear: `contacts`, `messages`, `followup_queue`, `followup_templates`, and `automation_settings`.

## 3. Put the code in a private GitHub repository

1. Open https://github.com/new
2. Repository name: `maidthis-meta-followups`
3. Select **Private**.
4. Do not add a README, `.gitignore`, or license on this screen.
5. Click **Create repository**.
6. Unzip the project and open the inner `maidthis-meta-followups` folder.
7. On the empty GitHub repository page, click **uploading an existing file**.
8. Drag all project files and folders into the page. Do not upload any `.env` file or `MaidThis-Railway-Variables.txt`.
9. Click **Commit changes**.

## 4. Deploy on Railway

1. Open https://railway.com/new
2. Choose **Deploy from GitHub repo** and authorize GitHub if asked.
3. Select the private `maidthis-meta-followups` repository.
4. Railway should detect the root `Dockerfile` automatically.
5. Open the service, then **Variables**.
6. Open the separate `MaidThis-Railway-Variables.txt` download. Paste its complete block into Railway's raw variable editor.
7. Replace `PASTE_NEW_SB_SECRET_KEY_HERE` with the new `sb_secret_...` value from your password manager.
8. Leave the Meta placeholders temporarily and click **Deploy**.
9. Open **Settings > Networking > Public Networking** and click **Generate Domain**.
10. Copy the HTTPS Railway domain.
11. Change `PUBLIC_BASE_URL` to that exact domain without a trailing slash, then redeploy.
12. Visit `https://YOUR-RAILWAY-DOMAIN/healthz`. It must show `{"ok":true}`.

## 5. Create and connect the Meta app

1. Open https://developers.facebook.com/apps/
2. Create an app for business use, or open the existing app connected to the MaidThis Page.
3. Add **Messenger** to the app.
4. In Messenger API Setup, connect the correct MaidThis Facebook Page.
5. Generate a Page access token. The Page must grant the app messaging access and the token must have `pages_messaging`. Meta may require App Review or Advanced Access before the app can message people who are not app roles.
6. Put these values in Railway Variables:
   - `META_BUSINESS_ACCOUNT_ID`: Facebook Page ID
   - `META_PAGE_ACCESS_TOKEN`: Page access token
   - `META_APP_SECRET`: App Secret
7. Redeploy the Railway service.
8. In the Meta app, open **Webhooks** and subscribe to the Page object.
9. Callback URL: `https://YOUR-RAILWAY-DOMAIN/webhooks/meta`
10. Verify token: copy `META_VERIFY_TOKEN` from Railway Variables.
11. Subscribe the Page to `messages`, `message_echoes`, `messaging_postbacks`, and `messaging_referrals` when those fields are offered.
12. Send the Page a test message from an account allowed to test the app.

## 6. Import history and test safely

1. Visit `https://YOUR-RAILWAY-DOMAIN/admin`.
2. Username: the `ADMIN_USER` value from Railway Variables.
3. Password: the `ADMIN_PASSWORD` value from the separate variables file.
4. Confirm **Global sending = Paused** and **Mode = Review required**.
5. Click **Import existing Meta history** once.
6. Compare at least 20 detected stages with Meta Business Suite.
7. Let the scheduler build review items while sending remains paused.
8. Change **Global sending** to **Enabled**, but keep **Review required** selected.
9. Approve individual messages for several days.
10. Only after reply cancellation and stage selection are consistently correct should you change the mode to **Automatic**.

## Policy boundary

The regular Meta Send API requires the person to have messaged the Page within the standard window. The system marks ineligible five-day follow-ups `blocked_policy`. Do not increase `standard_window_hours` or use a browser robot to bypass that rule.
