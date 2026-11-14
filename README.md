# AnimePlex Admin Studio

A standalone React/Vite administration dashboard for AnimePlex using Supabase authentication and a Vercel admin API.

## Features
- Secure Supabase email/password sign-in; no public admin signup
- Persistent browser sessions with automatic token refresh, recovery after temporary connection issues and current-browser sign-out
- Server-side JWT verification and admin role authorization
- Responsive AnimePlex command center with animated branding, light/dark appearance, reduced-motion support and eight dashboard/app palettes
- Registry overview and seven-day admin audit activity, refreshed every 30 seconds while the dashboard is visible
- App switches, curated and custom feature flags, home message, source repository management and default provider settings
- Appearance Studio with a visual phone mockup and editable display name, tagline, home layout, opening screen, navigation, animation, posters and background URL
- User listing, reversible suspension and owner-only deletion
- OTA APK upload, streaming SHA-256 calculation, release drafts, publish/pause/rollback and staged rollout manifest endpoint
- Featured content CRUD (title, artwork, destination, category and order)
- Announcement CRUD
- Remote app configuration registry
- TV pairing request monitor with pending-code expiry (pairing secrets are redacted)
- Admin role management and audit trail
- Backup metadata view without exposing private backup payloads
- Infrastructure health probes
- Local-only dashboard preferences and authenticated access
- Change the signed-in administrator's email or password from Settings after verifying the current password
- Quick dashboard search (Ctrl/⌘ + K) and a mobile navigation dock

## Run locally
```bash
npm ci
cp .env.example .env.local
npm run dev
```

The dashboard requires its Supabase environment variables and an active administrator membership. The Vite development server alone does not run the production Vercel API routes. Run `npm test` and `npm run build` for local checks.

## Admin session
After sign-in, Supabase stores the session in the current browser and refreshes it automatically. The app retains the existing Supabase storage key so a deployment does not intentionally sign users out. A temporary network problem shows a reconnect option instead of clearing the session; signing out explicitly affects the current browser session. Browser storage clearing, private browsing, a revoked session, password changes or project-enforced expiry can still require a new sign-in.

In Settings, an active administrator can change their own email or password after the server verifies their current password. The server never logs credential values. A change may require signing in again, depending on Supabase session settings. No default credentials or secret key belong in the repository.

## Required setup
Read [Admin setup](docs/ADMIN_SETUP.md) before connecting the Supabase project. Apply the SQL migration, bootstrap your first owner, and configure the Vercel environment variables.

## Vercel
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Node.js: 22 or newer

## Security
The Supabase service-role key is used only inside Vercel Functions. Never add it to a VITE_ variable or commit it. Every admin API request verifies the Supabase access token and checks the active admin role. Admin data tables have RLS enabled and no direct browser policies.

## OTA client integration is still required
The admin can create a release and expose a public staged-rollout manifest at `/api/ota/manifest`. The manifest is Ed25519-signed by a server-only private key and includes the APK SHA-256 checksum. The current AnimePlex-V1 Flutter updater still checks GitHub Releases. A separate app-side change is required to consume this manifest and verify SHA-256 before handing the APK to Android's installer. The admin release centre alone does not force an update on installed devices.

## Module and integration status
- Once the existing Supabase schema and Vercel environment are configured: users, TV pairing request metadata, featured content registry, announcements registry, app settings registry, OTA release registry, admin access, audit log, backup metadata and basic health checks use real records. Registry overview and audit analytics poll every 30 seconds; they are not a WebSocket feed.
- Settings, themes, source repositories and flags are stored in `app_settings` under validated keys. The `app_ui` object holds appearance choices; `theme_preset` selects one of eight palettes; `feature_flags` holds supported feature switches. Changing these values does not yet change installed apps: the Flutter app needs a separate integration and supported behavior for each setting. The phone mockup is illustrative, not a connected device.
- Playback, live viewers, crashes, source success rates and complete device inventory require app-side telemetry. These are not currently collected or displayed as live numbers.
- App-side integration is also pending for featured content, announcements and OTA manifest consumption. Announcements are registry entries, not push notifications.
- A repository code change does not automatically update an installed Flutter app. Remote configuration can change supported data after integration; native code/assets require a new APK, and a dedicated compatible OTA solution would need its own integration and limitations.
- Restore: metadata only; destructive restore is intentionally not exposed yet.

## Documentation
- [Admin setup](docs/ADMIN_SETUP.md)
- [Project plan](docs/PROJECT_PLAN.md)
- [Security baseline](docs/SECURITY.md)
- [Deployment guide](docs/DEPLOYMENT_VERCEL.md)
- [Change log](docs/CHANGELOG.md)
