# Admin security baseline

- The Supabase service-role key is server-only. It must never appear in a VITE_ variable, browser bundle, repository file or client log.
- Every privileged API request validates the Supabase access token and active admin_members role.
- Admin schema tables have RLS enabled and no anon/authenticated browser policies; admin data is accessed only through the trusted Vercel API.
- Roles are owner, admin, release_manager, moderator and auditor. Destructive actions are role-gated.
- User deletion runs an application-data cleanup function before deleting the Auth account. This includes user library/history/backup metadata, viewer profiles, TV rooms and associated bridge journals where present.
- Backup payloads are not returned to the browser. Restore is intentionally unavailable until a tested recovery workflow exists.
- APK uploads use one-time signed upload URLs. The browser computes SHA-256 incrementally; the checksum is stored with the release.
- The public OTA manifest is signed with Ed25519 using OTA_SIGNING_PRIVATE_KEY on the server. The matching public key must be pinned in the Flutter app. Do not trust a download URL or checksum until the app verifies the signature.
- Use HTTPS only. Vercel response headers deny framing, disable MIME sniffing and set a strict referrer policy.
- Announcements accept HTTP/HTTPS action URLs only.
- Admin actions are written to the audit log. Never place passwords, access tokens, signing keys, backup payloads or tracker credentials in audit details.

## Required before production
- Apply and review the SQL migration in the intended Supabase project.
- Bootstrap only the intended owner account.
- Configure the Supabase server credentials and Ed25519 signing key in Vercel.
- Pin the matching public key and key id in AnimePlex-V1 before enabling the OTA manifest client.
- Verify APK SHA-256 after download and before Android package installation.
- Test staged rollout, pause and rollback with test devices.
- Verify backup restore and database recovery independently before exposing restore controls.
