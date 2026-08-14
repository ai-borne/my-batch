# GS-0 verification baseline

This record defines the repeatable local and CI release baseline. It contains no Firebase project aliases, credentials, personal data, UTRs, receipts, or media fixtures.

## Supported toolchain

| Tool | Supported version | Enforcement |
| --- | --- | --- |
| Node.js | 22.16.0 | `.nvmrc`, root `engines`, CI |
| npm | 11.7.0 | root `packageManager`; CI uses the npm bundled with Node 22 |
| Firebase CLI | 15.27.0 | root dev dependency and lockfile |
| Java | 21 | required by the Firestore emulator in CI |
| Chromium / Playwright | 1.62.1 | root dev dependency; installed in CI |
| Firebase emulators | Firebase CLI 15.27.0 | ports in `firebase.json` |

Node 22 is the runtime required by Cloud Functions. Local Node 24 may be used only for exploratory work; it is not the supported release runtime.

## Scripts, ports, and fixtures

| Surface | Command | Port(s) | State / cleanup |
| --- | --- | --- | --- |
| Unit and release controls | `npm test`, `npm run test:coverage`, `npm run test:architecture`, `npm run release:controls` | none | no emulator state |
| Rules | `npm run test:rules` | Auth 29099, Firestore 28080 (websocket 28152), Storage 29199 | `firebase emulators:exec` creates and stops an isolated suite |
| Functions | `npm run test:functions` | Auth 39099, Firestore 38080 (websocket 38152), Functions 35001, Eventarc 39299, Tasks 39499 | `firebase emulators:exec` creates and stops an isolated suite |
| Browser | `npm run test:e2e` | app 4173; Auth 49099, Firestore 48080 (websocket 48152), Storage 49199, Functions 45001, Eventarc 49299, Tasks 49499 | Playwright starts a signal-forwarding launcher that stops its complete emulator process group |

The browser fixture is synthetic only: `tests/e2e/global.setup.cjs` provisions five `@example.test` identities and a test batch in the emulator. Rules and Functions tests clear their state before each test. Do not start `npm run emulators` while an emulator-backed test command is running.

Run this clean-start proof twice, sequentially, from a checkout with dependencies installed:

```sh
npm run test:rules
npm run test:functions
```

The commands own their emulator lifecycle, so no manual port or process cleanup is permitted between runs.

## CI and required repository settings

`.github/workflows/ci.yml` runs the complete release suite for pull requests to `main`, pushes to `main`, and manual dispatch. It uploads coverage and Playwright failure artifacts. `.github/workflows/dependency-review.yml` runs the production audit weekly and on manual dispatch.

Before release, a repository administrator must protect `main` and require the `verify` check from this workflow for pull requests. GitHub branch-protection settings cannot be enforced by repository code; the missing setting blocks GS-0 completion.

CI rejection proof: on a temporary pull request, deliberately fail one unit test, one Rules test, and one Playwright test in separate commits. Each run must fail the required `verify` check. Revert those proof commits before merge.

## Dependency review

All direct dependencies use intentional reviewed semver ranges and both lockfiles are committed. The scheduled workflow runs `npm audit --omit=dev --audit-level=high` at 09:00 UTC every Monday. Its named review owner must be recorded in the private operator record before production release; absent ownership blocks that release.

## Evidence required for GS-0 handoff

Record two consecutive successful `verify` workflow URLs/IDs for commits, a passing production audit, the two local clean-start results, and branch-protection confirmation against the release candidate SHA. This repository cannot create CI runs or alter branch protection without GitHub authority.
