# AnimePlex Admin — Project Plan

## Goal
Build and validate a standalone administration dashboard in this repository before integrating the app-side contracts into AnimePlex-V1.

## Stack
- React 18 + Vite
- Supabase Auth and database
- Vercel serverless API functions
- Supabase Storage for APK files
- Recharts and Lucide React

## Dashboard modules
1. Overview and infrastructure health
2. User management (list, suspend, restore, owner-only delete)
3. TV pairing request monitor (safe metadata and pending-code expiry)
4. Featured content registry (title, artwork, destination, category, visibility and order)
5. Announcements registry
6. OTA release management and Stable/Beta/Testing channels
7. Remote app configuration
8. Backup metadata view (read-only)
9. Admin audit history
10. Admin role management

## OTA release contract
A release stores:
- Android / Android TV platform
- Semantic version and positive monotonically increasing version code per platform/channel
- Stable, Beta or Testing channel
- Mandatory/optional policy and rollout percentage
- Release notes, APK public URL, file size and SHA-256
- Publication timestamp

The public manifest endpoint evaluates staged rollout against a stable installation ID and signs the manifest with an Ed25519 private key held only in Vercel. The Flutter client must pin the matching public key, verify the signature, download the APK, verify SHA-256, and then use Android's authorized installer flow. Rollback marks the bad release inactive so the previous published version becomes the newest available release; it does not silently downgrade devices.

## Security
- Supabase service-role and Ed25519 private keys stay server-side.
- Each API request verifies the Supabase JWT and active admin role.
- Roles: owner, admin, release_manager, moderator, auditor.
- Admin tables have RLS enabled, no browser grants, and explicit service-role privileges.
- Per-admin API request limiter: 120 requests/minute.
- Destructive user deletion uses a cleanup function for user-owned records and bridge journals before deleting the Auth account.
- Backup payloads and TV pairing secrets are never returned to the browser.
- Sensitive actions are audit logged.

## Current implementation state
- [x] Responsive dark/light dashboard shell and mobile navigation
- [x] Supabase email/password sign-in
- [x] Vercel API JWT validation and role-based authorization
- [x] Dashboard metrics from live Supabase tables
- [x] User management, pagination, suspend/restore and owner-only deletion
- [x] TV pairing request monitor and pending-code expiry
- [x] Featured content registry CRUD
- [x] Announcement registry CRUD
- [x] Remote app configuration registry
- [x] APK upload, streaming SHA-256, release lifecycle and Ed25519-signed staged-rollout manifest
- [x] Admin role grants and disable controls
- [x] Audit log, health checks and backup metadata
- [x] Vercel security headers and CI checks for frontend build/API syntax
- [ ] Apply migration and configure project secrets in Supabase/Vercel
- [ ] Connect Flutter updater to the signed manifest and verify SHA-256
- [ ] Connect Flutter app to remote config and announcement registry
- [ ] Connect featured content feed to Flutter home screen
- [ ] Add full signed-in device inventory telemetry
- [ ] Add a tested backup restore workflow and recovery drill
- [ ] Add production analytics/usage telemetry

## Deployment boundary
The admin frontend and API are in this repository. AnimePlex-V1 has not been modified. Live operations remain disabled until the migration and Vercel environment variables are configured. OTA releases created here will not reach installed apps until the separate Flutter updater integration is completed.

## Change log
- 2026-11-11: Initialized the dashboard, implemented Supabase/Vercel API modules, OTA signing, content and TV pairing controls, role-based access, audit logging and project setup documentation.
