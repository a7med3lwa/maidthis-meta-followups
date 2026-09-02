# Meta App Review Preparation for MaidThis Follow-ups

Meta decides whether the application can use messaging permissions with real Page and Instagram users. This document provides truthful, narrowly scoped explanations for the features implemented in the app. Adjust only details that actually change before submitting.

## Reviewer entry points

- Application: `https://maidthis-meta-followups-production.up.railway.app/admin`
- OAuth callback: `https://maidthis-meta-followups-production.up.railway.app/oauth/meta/callback`
- Privacy: `https://maidthis-meta-followups-production.up.railway.app/privacy`
- Terms: `https://maidthis-meta-followups-production.up.railway.app/terms`
- Data deletion: `https://maidthis-meta-followups-production.up.railway.app/data-deletion`

Provide Meta reviewers with temporary application credentials and a test Page/account when the review form requests them. Do not place credentials in the public privacy policy or screencast.

## Permission explanations

### `pages_show_list`

The administrator clicks “Connect Facebook & Instagram” and signs in through Facebook Login. The application uses `pages_show_list` to display the Facebook Pages that the administrator can manage so they can select the specific MaidThis Page to connect. The application does not connect every returned Page automatically.

### `pages_read_engagement`

The application uses `pages_read_engagement` only to retrieve the selected Page's basic identifying information needed to label the connected inbox and associate conversations with the correct Page. It does not publish Page content or use engagement data for advertising profiles.

### `pages_manage_metadata`

After the administrator selects a Page, the application uses `pages_manage_metadata` to subscribe that Page to the application's message webhook. This is required so new customer replies can cancel scheduled follow-ups and update the lead's conversation state.

### `pages_messaging`

The application uses `pages_messaging` to read Messenger conversations for the selected Page and send the next approved MaidThis sales follow-up. Messages are limited by global pause, review mode, opt-out detection, duplicate checks, booking/lead status, stage order, and Meta's standard messaging window.

### `instagram_basic`

The application uses `instagram_basic` to identify the Instagram professional account linked to an authorized Facebook Page and display its username in the account chooser and connected-inbox dashboard.

### `instagram_manage_messages`

The application uses `instagram_manage_messages` to receive Instagram Direct messages, import conversation history where the API permits it, cancel queued messages after a reply, and send the next administrator-approved follow-up within Meta's allowed messaging window.

## Screencast sequence

Record one continuous video showing:

1. The dark MaidThis dashboard with global sending paused.
2. Clicking **Connect Facebook & Instagram**.
3. The browser leaving the MaidThis domain and opening Meta's authorization screen.
4. Reviewing and granting the requested permissions.
5. Returning to the MaidThis account chooser.
6. Selecting one test Facebook Page and its linked Instagram professional account.
7. Seeing both connected inboxes on the dashboard.
8. Clicking **Import history** and showing a test lead appear.
9. Receiving a test Messenger or Instagram reply and showing the lead status update.
10. Approving one in-window test follow-up and showing it arrive in the test inbox.
11. Showing the **Disconnect** control and the public privacy/data-deletion pages.

If Meta requests separate recordings per permission, reuse the relevant portions but ensure each recording visibly exercises that exact permission.

## Data-handling summary

The application stores Page/Instagram account IDs, basic account labels, conversation participant identifiers, message content, timestamps, template-stage matches, and audit results. Meta access tokens are encrypted with AES-256-GCM before storage. Data is used only for MaidThis inbox follow-up operations, is not sold, and can be removed by disconnecting the account or through Meta's signed data-deletion callback.

## Review readiness checklist

- App icon and category completed
- App domain configured
- Privacy and Terms URLs load without authentication
- Data-deletion URL accepts Meta's callback and has a public explanation page
- OAuth redirect URI matches exactly
- Webhook callback verification succeeds
- Test Page and Instagram professional account are available
- Reviewer credentials work in a private/incognito browser
- Screencast shows the permission being exercised, not only the permission prompt
- Application starts paused and demonstrates policy checks
- Business verification completed if Meta requires it for the requested access level

