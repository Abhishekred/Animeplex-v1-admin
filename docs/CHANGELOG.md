# Change log

## 2026-11-14 — Authenticated administration
- Removed sample-data preview access and retained authenticated administrator sign-in.
- Added current-password verification before changing an administrator's email or password.
- Made missing app-side profiles, backups and TV pairing tables visible as unavailable without blocking the admin dashboard.

## 2026-11-14 — Session continuity and navigation
- Added resilient session restoration, recovery after temporary network errors and one retry with a refreshed token for an unauthorized admin request.
- Scoped manual sign-out to the current browser session and retained the existing Supabase session storage key.
- Added a searchable command palette, quick mobile navigation dock, a session panel and refined dashboard styling.
- Tested session restore, token refresh, local sign-out and recovery with a mocked Supabase Auth service.

## 2026-11-14 — Enhanced control room
- Added eight curated palettes, a richer animated command-center overview, and matching dashboard themes.
- Added an appearance studio with a visual phone mockup and validated app name, tagline, layouts, navigation, motion, poster and background controls.
- Added curated feature switches alongside custom flags and kept mobile app integration explicitly separate.

## 2026-11-13 — AnimePlex Admin Studio
- Refreshed the responsive dashboard and added isolated sample preview, dashboard themes and motion settings.
- Added admin audit activity analytics with 30-second polling, app controls, feature flags, appearance and source repository management.
- Added edit flows for announcements and featured content, restored TV pairing data loading, improved role-gated controls and fixed release platform selection during publishing.
- Validated new settings server-side and added checks for authorization, configuration, audit aggregation and preview isolation. CI now uses the npm cache and lockfile.
- App connection, mobile telemetry, app-facing remote settings and OTA client consumption remain separate work.

## 2026-11-11 — Admin dashboard foundation
- Initialized the standalone AnimePlex Admin repository.
- Added Vite + React application scaffold.
- Added premium responsive dark dashboard UI and light theme switch.
- Added dashboard overview with sample metrics, audience chart, service-health panel, recent activity and quick actions.
- Added OTA release center UI, release table and create-release modal.
- Added module navigation shells for users, devices, content, announcements, channels, app configuration, system health, backups, logs, admin access and settings.
- Added project plan, security requirements and Vercel deployment instructions.
- No AnimePlex-V1 files were changed.
- No live backend or OTA operation is enabled.

## 2026-11-11 — Secure admin API and functional modules
- Added Supabase email/password sign-in.
- Added Vercel API route with Supabase JWT verification and role-based authorization.
- Added owner/admin/release_manager/moderator/auditor roles.
- Added live user list, suspend/restore and owner-only account deletion endpoints.
- Added announcement create/update/enable/disable/delete.
- Added remote app configuration registry.
- Added admin grant and access disable operations.
- Added backup metadata-only view, audit log and infrastructure health checks.
- Added direct APK upload through signed Supabase Storage upload URLs.
- Added streaming SHA-256 calculation, checksum requirement and public staged-rollout OTA manifest.
- Added SQL schema migration, first-owner bootstrap guide and environment template.
- Device inventory and content catalogue remain pending app-side telemetry/schema.
- The Flutter app still uses upstream GitHub Releases; OTA manifest consumption is a separate AnimePlex-V1 change.

## 2026-11-11 — Admin controls hardening
- Added TV pairing request monitor and pending-code expiry without exposing pairing secrets or tracker tokens.
- Added paginated user management.
- Added transactional user-owned data cleanup before owner-only account deletion.
- Added Ed25519 signature to the public OTA manifest; private signing key remains server-only.
- Added SQL checks for HTTPS announcement actions, release checksums, file sizes and unique platform/channel build codes.
- Added baseline Vercel security response headers and CI syntax checks for serverless APIs.

## 2026-11-11 — Featured content management
- Added featured content table and owner/admin API CRUD.
- Added title, description, category, image URL, destination URL, visibility and display-order controls.
- Added HTTP/HTTPS URL validation and audit logging.
- The Flutter home feed still needs to consume the featured content registry.

## 2026-11-11 — API hardening
- Added database-backed per-admin rate limiting (120 requests per minute).
- Added explicit server-role table and audit sequence grants.
- Added Content Registry and platform-specific OTA version-code validation.
