# MaidThis Meta Follow-ups v3

A standalone Facebook Messenger and Instagram follow-up service with a dark operations dashboard, deterministic 10-stage tracking, reply cancellation, duplicate protection, encrypted Meta tokens, and Meta policy checks.

Start with [FINAL-SETUP-GUIDE.md](FINAL-SETUP-GUIDE.md). It contains the complete GitHub, Supabase, Railway, Meta, testing, rollout, and troubleshooting procedure.

## What changed in v3

- Default provider is `meta_manual`.
- Removed the custom Facebook Login dependency from the normal setup.
- The dashboard accepts a Page access token generated through Meta's Messenger API Setup.
- The app verifies the token, subscribes the Page webhook, encrypts the token, and discovers linked Instagram automatically.
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

For local runtime, copy `.env.example` to `.env`, replace every placeholder, and run:

```bash
npm start
```

For Railway, use `RAILWAY-VARIABLES.txt`. Railway supplies the runtime `PORT` automatically.

## Project layout

```text
Dockerfile                  Railway/container build
FINAL-SETUP-GUIDE.md        Complete operator instructions
GENERATE-SECRETS.html       Offline browser-based secret generator
RAILWAY-VARIABLES.txt       Clean Railway variable template
public/                     Follow-up images
sql/                        Supabase migrations and templates
src/                        Service, dashboard, Meta, scheduling, storage
test/                       Dependency-free Node test suite
```

## Important limitation

No custom app can bypass Meta's Page access, App Review, Live-mode, or 24-hour messaging rules. The token route makes setup simpler. It does not grant permissions Meta has not given to the logged-in Facebook profile or app.
