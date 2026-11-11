# AnimePlex Admin — Project Plan

## Goal
Build and validate a standalone administration dashboard in this repository before integrating it with AnimePlex-V1.

## Current stack
- Vite + React
- Recharts for dashboard analytics
- Lucide React icons
- Vercel-compatible static frontend build

## Modules
1. Overview and platform health
2. Users and devices
3. Content and announcements
4. OTA release management
5. Release channels (Stable, Beta, Testing)
6. Remote app configuration and feature flags
7. Backups and restore operations
8. Logs and audit history
9. Admin roles, permissions and security

## OTA release contract (planned)
A release should contain:
- Platform and package type
- Semantic version and monotonically increasing version code
- Release channel and rollout percentage
- Mandatory/optional update policy
- Release notes and minimum supported version
- Download URL, file size and SHA-256 checksum
- Signed manifest and publication timestamps

The client app must verify the manifest and checksum before installing. Android package installation remains subject to Android's user/device authorization flow. Rollback means stopping or reducing rollout and selecting a previous known-good release; it does not silently downgrade installed apps.

## Security requirements
- No service-role keys, signing keys, storage secrets or admin credentials in browser code.
- Admin authorization must be checked by a trusted server endpoint on every privileged action.
- Role-based access control and audit events for destructive or sensitive operations.
- Uploads must be validated server-side for type, size, checksum and release metadata.
- Secrets are configured as Vercel environment variables or server-side platform secrets, never committed.

## Current implementation state
- Dashboard shell and responsive navigation: implemented as preview UI.
- Overview analytics: illustrative sample data only.
- OTA release list and create-release modal: UI preview only.
- Other modules: navigation and module shells only.
- Live API integration: not implemented.
- AnimePlex-V1 integration: intentionally deferred.

## Change log
- 2026-11-11: Initialized the repository and added the first standalone dashboard UI scaffold.

## Functional implementation status (2026-11-11)
- [x] Supabase sign-in client and protected API session
- [x] Server-side JWT validation and role checks
- [x] User list, suspend/restore, owner-only delete
- [x] Announcement registry CRUD
- [x] App configuration registry
- [x] OTA APK upload, SHA-256 metadata, release lifecycle and rollout manifest
- [x] Admin role grants and access disable
- [x] Audit log, health checks and backup metadata
- [ ] Connect Flutter updater to /api/ota/manifest and verify SHA-256
- [ ] Connect remote app config and announcement feed in Flutter
- [ ] Build device telemetry and central content management contracts
- [ ] Add tested backup restore workflow and recovery drill

No live service is enabled until the migration is applied and the Vercel environment variables are configured.
