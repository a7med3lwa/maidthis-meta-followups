# Connect the MaidThis Follow-up App Through HighLevel

Use this route when Facebook Messenger and Instagram are already connected and working inside the MaidThis HighLevel sub-account. You do **not** need to create a Meta developer app or ask the Meta Business Portfolio owner for more access.

Keep **Global sending = Paused** until the history import has been checked.

## 1. Update the Railway code

The GitHub repository shown in your screenshots is flat: the JavaScript files are in the repository root instead of a `src` folder. Upload the five files from `MaidThis-HighLevel-Railway-Upgrade.zip` to the root of that same repository and choose **Commit changes**:

- `config.js`
- `dashboard.js`
- `highlevel.js` (new)
- `server.js`
- `Dockerfile` (replacement)

Railway will redeploy automatically after the GitHub commit.

## 2. Create a HighLevel Private Integration

Do this inside the MaidThis HighLevel **sub-account/location**, not at the Facebook or Meta website.

1. Open the MaidThis sub-account in HighLevel.
2. Open **Settings** in the lower-left corner.
3. Open **Private Integrations**.
4. Click **Create new integration**.
5. Name it `MaidThis Follow-up App`.
6. Enable only these scopes:
   - `conversations.readonly`
   - `conversations/message.readonly`
   - `conversations/message.write`
7. Create the integration and copy the generated token. HighLevel shows it only once.

If **Private Integrations** is missing, switch to Agency view and open **Settings > Labs**, enable Private Integrations, then return to the MaidThis sub-account. HighLevel says agency admins can create these by default, but the permission can be restricted per user.

Never paste this token into chat, GitHub, a screenshot, or `.env.example`. It belongs only in Railway Variables.

Official HighLevel instructions: [Private Integrations](https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/)

## 3. Find the HighLevel Location ID

1. Stay inside the MaidThis sub-account.
2. Open **Settings > Business Profile**.
3. Copy the displayed **Location ID**.

You can also copy the value after `/location/` in a URL such as:

`https://app.gohighlevel.com/v2/location/LOCATION_ID/dashboard`

Do not use the Agency ID, User ID, Facebook Page ID, or Instagram ID.

Official HighLevel instructions: [Find a Location ID](https://help.gohighlevel.com/support/solutions/articles/48001204848-how-do-i-find-my-client-s-location-id-)

## 4. Add the five Railway variables

1. Open [Railway](https://railway.app/dashboard).
2. Open the MaidThis project.
3. Click the deployed service card named something like **maidthis-meta-followups**. Do not click the project background.
4. In the service page, click the **Variables** tab at the top.
5. Click **New Variable** or **Raw Editor**.
6. Add these values:

```dotenv
MESSAGING_PROVIDER=highlevel
HIGHLEVEL_API_TOKEN=PASTE_THE_PRIVATE_INTEGRATION_TOKEN_HERE
HIGHLEVEL_LOCATION_ID=PASTE_THE_LOCATION_ID_HERE
HIGHLEVEL_API_VERSION=v3
HIGHLEVEL_POLL_LIMIT=100
```

Do not delete the working Supabase, password, URL, or scheduler variables. The old `META_...` variables may remain; the app ignores them while `MESSAGING_PROVIDER=highlevel`.

Railway will redeploy when the variables are saved. Wait until the deployment shows **Success**.

## 5. Verify the new deployment

Open:

- Health check: <https://maidthis-meta-followups-production.up.railway.app/healthz>
- Dashboard: <https://maidthis-meta-followups-production.up.railway.app/admin>
- Skeleton test: <https://maidthis-meta-followups-production.up.railway.app/media/skeleton.jpg>
- Mr. Bean test: <https://maidthis-meta-followups-production.up.railway.app/media/mr-bean.png>

The health check must show:

```json
{"ok":true}
```

The dashboard subtitle should say **Connected through HighLevel**, and the button should say **Import existing HighLevel history**.

## 6. Import and check history safely

1. Confirm the dashboard still says **Sending: Paused** and **Mode: Review**.
2. Click **Import existing HighLevel history** once.
3. Wait for the green import result. A large account can take a few minutes.
4. Compare at least 20 imported leads with the HighLevel Conversations inbox.
5. Verify that ordinary staff replies do not change the stage, while the known MaidThis follow-up templates do.
6. Pay special attention to follow-ups #3 and #9 because they contain media.

The import is idempotent: clicking it again will not duplicate messages.

## 7. Run in review mode first

1. Leave **Mode = Review required**.
2. Change **Global sending** to **Enabled** only after the history check passes.
3. Click **Save controls**.
4. Review each proposed follow-up before using **Send now**.
5. Test with one internal/test conversation first.
6. Keep review mode for several days. Switch to automatic only after replies, stage detection, cancellations, and media sends have all been verified.

The app synchronizes recent HighLevel Messenger and Instagram messages before every five-minute scheduler run. A new customer reply cancels a queued follow-up. The final send check also refuses booked, paused, opted-out, completed, duplicate, wrong-stage, or outside-window messages.

## Important Meta policy limit

Using HighLevel removes the need for your own Meta app credentials, but it does not remove Meta's messaging rules. HighLevel's own Messenger and Instagram workflow documentation says outbound automation is limited to contacts who messaged within the previous 24 hours. This app enforces that window and marks an ineligible item `blocked_policy`.

- [HighLevel Facebook Messenger workflow rules](https://help.gohighlevel.com/support/solutions/articles/155000003292/)
- [HighLevel Instagram DM workflow rules](https://help.gohighlevel.com/support/solutions/articles/155000003298-instagram-dm-workflow-action)

Do not increase the database's standard window to bypass Meta policy.

## Quick troubleshooting

| Error | Fix |
|---|---|
| `Missing required environment variable: HIGHLEVEL_API_TOKEN` | Add the token under the Railway service's **Variables** tab and redeploy. |
| `HighLevel API: 401` | The token is invalid, expired, or pasted with extra spaces. Rotate it in HighLevel and replace it in Railway. |
| `HighLevel API: 403` | Add the three Conversations/Message scopes to the Private Integration. |
| Import shows zero conversations | Verify `HIGHLEVEL_LOCATION_ID` belongs to the exact sub-account where Messenger/Instagram works. |
| Dashboard still says direct Meta | Confirm `MESSAGING_PROVIDER` is exactly `highlevel`, then redeploy. |
| Message becomes `blocked_policy` | The contact is outside Meta's allowed messaging window; do not force-send it through automation. |
| Media fails | Open both `/media/...` links above and confirm each loads publicly. |

