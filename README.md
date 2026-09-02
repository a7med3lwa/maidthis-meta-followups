# MaidThis Meta Follow-ups v3.1

A standalone Facebook Messenger and Instagram follow-up service with a dark operations dashboard, deterministic 10-stage tracking, reply cancellation, duplicate protection, encrypted Meta tokens, and Meta policy checks.

Start with [FINAL-SETUP-GUIDE.md](FINAL-SETUP-GUIDE.md). It contains the complete GitHub, Supabase, Railway, Meta, testing, rollout, and troubleshooting procedure.

## What changed in v3.1

- Default provider is `meta_manual`.
- Removed the custom Facebook Login dependency from the normal setup.
- Connects using the Page ID Meta displays, so `pages_read_engagement` is not required just to save the token.
- The dashboard accepts the MaidThis Page ID and Page access token generated through Meta's Messenger API Setup.
- The app avoids optional Page-metadata lookups, encrypts the token, attempts the Page webhook subscription, and adds a permitted Instagram inbox when its first webhook arrives.
- HighLevel, n8n, and old duplicate deployment files are excluded from the final clean ZIP.
- Dark mode remains the default. Light mode remains available from the dashboard header.

## Safety behavior

- Sending starts paused and review-required.
- A customer reply cancels queued follow-ups.
- Ordinary sales conversation does not advance the follow-up stage.
- A known MaidThis template advances only its matching stage.
- Every send rechecks lead state, stage, duplication, and Meta's standard messaging window.
- Booked, paused, opted-out, and completed leads do not send.

## Local verification

The app requires Node.js 22 or later and has no production npm dependencies.

```bash
npm test
npm run check
```

For local runtime, supply the same environment variables already configured in Railway and run:

```bash
npm start
```

Railway supplies the runtime `PORT` automatically. Version 3.1 uses the existing Railway variables and requires `MESSAGING_PROVIDER=meta_manual`.

## Project layout

```text
Dockerfile                  Railway/container build
FINAL-SETUP-GUIDE.md        Complete operator instructions
public/                     Follow-up images
sql/                        Supabase migrations and templates
src/                        Service, dashboard, Meta, scheduling, storage
test/                       Dependency-free Node test suite
```

## Important limitation

No custom app can bypass Meta's Page access, App Review, Live-mode, or 24-hour messaging rules. The token route makes setup simpler. It does not grant permissions Meta has not given to the logged-in Facebook profile or app.
