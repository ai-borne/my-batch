# Streamlined Development Workflow

This document is the single mental model for how to work on this project. It
replaces the confusion of juggling localhost, staging, and production with a
clear, repeatable flow.

## The three environments

There are exactly **three** environments. You are always in exactly one of them.

| Environment | What it is | App Check | Data |
|---|---|---|---|
| **local** | Firebase Emulator Suite on your machine | off | seeded demo data |
| **staging** | a deployed non-production Firebase project | on | synthetic demo data |
| **production** | the live Firebase project | on | real member data |

The app decides which environment it is in from a single value: `VITE_APP_ENV`
(`local` | `staging` | `production`). See `src/lib/environment.ts`.

## The one rule

> **Never mix environments.** Each command below targets exactly one
> environment. If a command needs a different environment, it says so.

## Git-driven deployment (the flow you asked for)

Your workflow is: **local → staging → production**, driven by git branches.

```
You (local)                    GitHub                        Firebase
─────────                      ──────                        ───────
feature branch ──push──▶  ┌───────────────────┐
                          │ CI runs tests      │──▶ STAGING  (my-batch-staging)
                          │ then auto-deploys  │    test your real site
                          └───────────────────┘
feature branch ──PR──▶ main ──push──▶ ┌───────────────────┐
                                      │ CI runs tests      │──▶ PRODUCTION (my-batch-0001)
                                      │ then auto-deploys  │    live site
                                      └───────────────────┘
```

- **Feature branch push** → deploys to **staging** (`my-batch-staging`). Test the
  real site there.
- **Push to `main`** → deploys to **production** (`my-batch-0001`). This is the
  live site.
- **Protect `main`** in GitHub Settings so you can only merge via Pull Request.
  This prevents accidental production pushes — you always review before launch.

The automation lives in `.github/workflows/deploy.yml`. It builds the frontend
with the correct `VITE_APP_ENV` for each target, then deploys hosting, functions,
Firestore rules, and indexes.

### GitHub secrets you must configure (once)

The workflow reads these from GitHub Secrets (Settings → Secrets and variables →
Actions). Create them for each project:

| Secret | Staging value | Production value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | staging service-account JSON | — |
| `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` | — | production service-account JSON |
| `FIREBASE_STAGING_API_KEY` | staging web API key | — |
| `FIREBASE_PRODUCTION_API_KEY` | — | production web API key |
| `FIREBASE_STAGING_AUTH_DOMAIN` | staging auth domain | — |
| `FIREBASE_PRODUCTION_AUTH_DOMAIN` | — | production auth domain |
| `FIREBASE_STAGING_STORAGE_BUCKET` | staging storage bucket | — |
| `FIREBASE_PRODUCTION_STORAGE_BUCKET` | — | production storage bucket |
| `FIREBASE_STAGING_MESSAGING_SENDER_ID` | staging sender ID | — |
| `FIREBASE_PRODUCTION_MESSAGING_SENDER_ID` | — | production sender ID |
| `FIREBASE_STAGING_APP_ID` | staging app ID | — |
| `FIREBASE_PRODUCTION_APP_ID` | — | production app ID |
| `FIREBASE_STAGING_RECAPTCHA_SITE_KEY` | staging reCAPTCHA key | — |
| `FIREBASE_PRODUCTION_RECAPTCHA_SITE_KEY` | — | production reCAPTCHA key |

The service-account JSON is the key file from each Firebase project's
Service Accounts page. Grant it the roles listed in the
[w9jds/firebase-action](https://github.com/w9jds/firebase-action) docs
(Cloud Functions Developer, Firebase Hosting Admin, Cloud Datastore Index Admin,
Firebase Rules Admin, etc.).

## Emulator port scheme (you never need to remember this)

The Firebase Emulator Suite is configured in four files, each with its own port
range so the test suites *could* run in parallel. **You do not need to remember
these** — `npm run dev:all` and `npm run test:all` handle them for you. This
table is only for reference when you see a port number in an error message.

| File | Used by | auth | firestore | storage | functions |
|---|---|---|---|---|---|
| `firebase.json` | manual dev (`dev:all`) | 9099 | 8080 | 9199 | 5001 |
| `firebase.rules.json` | `test:rules` | 29099 | 28080 | 29199 | — |
| `firebase.functions.json` | `test:functions` | 39099 | 38080 | — | 35001 |
| `firebase.e2e.json` | `test:e2e` | 49099 | 48080 | 49199 | 45001 |

The pattern is easy to spot: each suite uses a different "tens" prefix
(`2`, `3`, `4`) on the same base ports. If you ever see a port conflict error,
it means a leftover emulator from a previous run is still holding a port — kill
it and re-run.

## Local development (one command)

```bash
npm run dev:all
```

This starts the emulators, seeds demo data, and runs the dev server — all in
one command. The app connects to the emulators automatically because
`VITE_APP_ENV=local`.

## Testing (one command)

```bash
npm run test:all
```

This runs every test suite in sequence: unit → architecture → release controls
→ rules → functions → e2e. If any step fails, it stops.

Individual suites (for faster iteration):

```bash
npm test                 # unit tests only
npm run test:rules       # Firestore/Storage rules tests
npm run test:functions   # cloud function integration tests
npm run test:e2e         # Playwright end-to-end tests
```

## Deploying

### Before any deploy — verify the build and tests

```bash
npm run build && npm run test:all
```

### Check what's actually deployed vs. what's in source

```bash
npm run deploy:check -- --project <project-id>
```

This compares the cloud functions in `functions/src/index.ts` against what is
deployed, and reports any that are missing or stale. **Run this before and
after every deploy.** It catches the exact bug where the frontend ships but the
backend callables it depends on were never deployed.

### Deploy functions

```bash
firebase deploy --only functions --project <project-id>
```

### Deploy hosting

```bash
firebase deploy --only hosting --project <project-id>
```

### Deploy everything

```bash
firebase deploy --project <project-id>
```

## Staging vs. production

- **Staging** uses a project whose ID contains `staging`. The seed script
  (`npm run seed:staging`) **refuses** to run against anything else, by design.
- **Production** is gated on private operator evidence (backup, App Check
  traffic, release-owner approval) per `AJINKYANS-PHASE-5-LAUNCH-RUNBOOK.md`.
  Production data is never seeded from the repo — it is imported privately.

## The deploy checklist (do this every release)

1. `npm run build` — passes
2. `npm run test:all` — passes
3. `npm run deploy:check -- --project <staging>` — source matches deployed
4. Deploy to staging, then `npm run deploy:check -- --project <staging>` again
5. Smoke-test staging in the browser
6. Record release-owner approval (production only)
7. Deploy to production, then `npm run deploy:check -- --project <production>`
8. Smoke-test production in the browser

## Environment variables

Copy `.env.example` to `.env.local` and set:

- `VITE_APP_ENV` — `local` | `staging` | `production`
- The `VITE_FIREBASE_*` values for the project you're targeting
- `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` — required for staging/production

Never commit `.env.local` or any service-account file. The release-controls
check (`npm run release:controls`) enforces this.