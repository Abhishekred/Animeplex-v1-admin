# AnimePlex Admin — Control Center

A standalone React/Vite administration dashboard for AnimePlex, designed for Vercel and backed by the existing AnimePlex Supabase project.

## Features
- Secure Supabase email/password sign-in; no public admin signup
- Server-side JWT verification and admin role authorization
- Dashboard metrics from live Supabase records
- User listing, reversible suspension and owner-only deletion
- OTA APK upload, streaming SHA-256 calculation, release drafts, publish/pause/rollback and staged rollout manifest endpoint
- Featured content CRUD (title, artwork, destination, category and order)
- Announcement CRUD
- Remote app configuration registry
- TV pairing request monitor with pending-code expiry (pairing secrets are redacted)
- Admin role management and audit trail
- Backup metadata view without exposing private backup payloads
- Infrastructure health probes
- Responsive dark/light dashboard

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Required setup
Read [Admin setup](docs/ADMIN_SETUP.md) before connecting the Supabase project. Apply the SQL migration, bootstrap your first owner, and configure the Vercel environment variables.

## Vercel
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Node.js: 20+

## Security
The Supabase service-role key is used only inside Vercel Functions. Never add it to a VITE_ variable or commit it. Every admin API request verifies the Supabase access token and checks the active admin role. Admin data tables have RLS enabled and no direct browser policies.

## OTA client integration is still required
The admin can create a release and expose a public staged-rollout manifest at `/api/ota/manifest`. The manifest is Ed25519-signed by a server-only private key and includes the APK SHA-256 checksum. The current AnimePlex-V1 Flutter updater still checks GitHub Releases. A separate app-side change is required to consume this manifest and verify SHA-256 before handing the APK to Android's installer. The admin release centre alone does not force an update on installed devices.

## Honest module status
- Live after setup: users, announcements registry, app settings registry, OTA release registry, admin access, audit log, backup metadata, basic health checks.
- Limited live view: TV pairing requests; complete signed-in device inventory and central content management remain pending.
- App-side integration pending: remote configuration, announcements feed and OTA manifest consumption.
- Restore: metadata only; destructive restore is intentionally not exposed yet.

## Documentation
- [Admin setup](docs/ADMIN_SETUP.md)
- [Project plan](docs/PROJECT_PLAN.md)
- [Security baseline](docs/SECURITY.md)
- [Deployment guide](docs/DEPLOYMENT_VERCEL.md)
- [Change log](docs/CHANGELOG.md)
