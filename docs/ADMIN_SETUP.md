# Admin Control Center setup

## 1. Apply the schema
Review and apply supabase/migrations/0001_admin_control_center.sql in the same Supabase project used by AnimePlex-V1.

## 2. Bootstrap the first owner
1. Create your own user in Supabase Auth (email/password).
2. Copy that user's UUID from Authentication → Users.
3. Run this once in the Supabase SQL editor, replacing the UUID with your own account:

   insert into public.admin_members (user_id, role, is_active)
   values ('YOUR_AUTH_USER_UUID', 'owner', true)
   on conflict (user_id) do update set role = 'owner', is_active = true;

4. Do not add public admin signup. Create accounts in Supabase Auth, then grant roles from the owner account.

## 3. Vercel environment variables
Set these values in the Vercel project:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL (server only)
- SUPABASE_SERVICE_ROLE_KEY (server only; never expose or commit)
- OTA_SIGNING_PRIVATE_KEY (server-only Ed25519 PEM private key)
- OTA_SIGNING_KEY_ID (public identifier pinned with the matching public key in the Flutter app)

Redeploy after changing environment variables.

## 4. Deploy
- Framework preset: Vite
- Build command: npm run build
- Output directory: dist
- Node.js runtime: 20+

## 5. Roles
- owner: full access, can grant/revoke admin roles and delete users.
- admin: user management, app settings and announcements.
- release_manager: OTA release creation, publishing, pausing and rollout changes.
- moderator: announcement management.
- auditor: read-only operational and audit views.


## 6. OTA signing key
Generate an Ed25519 key pair on a trusted machine:

```bash
openssl genpkey -algorithm ED25519 -out ota-ed25519-private.pem
openssl pkey -in ota-ed25519-private.pem -pubout -out ota-ed25519-public.pem
```

- Store the contents of the private PEM only in Vercel as OTA_SIGNING_PRIVATE_KEY.
- Set OTA_SIGNING_KEY_ID to a short versioned identifier such as animeplex-ota-2026-01.
- Keep the public key for the Flutter app integration. Pin it in the app and verify the manifest signature before trusting the download URL or checksum.
- Never commit either key file. If the private key is exposed, rotate to a new key id and ship the new public key in the app before publishing with it.
- The manifest endpoint intentionally returns 503 until the private key and key id are configured.

## 7. OTA integration boundary
The admin API stores APKs, calculates SHA-256 while uploading, stores release metadata and exposes a staged-rollout manifest at /api/ota/manifest. The AnimePlex-V1 Flutter updater currently reads GitHub Releases. It must be migrated in a separate reviewed change to query this manifest, pass a stable installation ID and verify the downloaded APK checksum before installation. Until then, publishing here does not make installed apps discover the release.

## 8. Backup safety
The admin API lists backup metadata only. It never returns backups.payload to the browser. One-click restore is not enabled; safe restore needs a target user, validation, a pre-restore snapshot and explicit owner confirmation.

## 9. Current integration limits
- Users, announcements, release registry, remote settings, audit and admin roles use live Supabase/Vercel APIs after setup.
- Devices currently shows TV pairing requests only (safe metadata and pending-code expiry); a complete signed-in device inventory needs app telemetry.
- Central content management remains pending because the app does not expose a central content catalogue API.
- Remote settings are stored but do not affect installed app behaviour until Flutter reads them.
- Announcement records are stored in the new table; the current app reads its feed from a GitHub raw JSON URL until its feed source is migrated.
