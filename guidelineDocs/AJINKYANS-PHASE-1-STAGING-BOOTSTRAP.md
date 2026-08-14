# Ajinkyans — Phase 1 staging bootstrap

Private identities and Firebase project IDs must be supplied by the deployment operator. They must never be committed.

1. Create separate Firebase projects for development and staging; enable Google Authentication, Firestore, Storage, and Cloud Functions in each.
2. Copy `.env.example` to `.env.local` and enter only the selected non-production project's public web configuration. Set `VITE_USE_FIREBASE_EMULATORS=true` for local work.
3. Privately set the Super Admin account's custom claim to `superAdmin: true`, then use an audited server-side provisioning operation to create the first active Coordinator membership. Do not grant either role through a browser client or Firestore console client.
4. Deploy Rules and Functions to staging only after `npm run build`, `npm test`, and `npm run test:rules` pass. Verify Google OAuth redirect domains and authorized domains for the staging URL.
5. Seed staging only with synthetic accounts and data. Confirm a pending account cannot access private data and an active account cannot access another batch.

The Super Admin identity, Coordinator identities, Firebase project IDs, billing ownership, and recovery contacts belong in the operator's private deployment system, not this repository.
