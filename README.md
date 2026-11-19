# AnimePlex Admin — Update Control

Fresh Vite admin workspace on the `admin` branch. No code or files were reused from `Abhishekred/ONLINE-DASHBOARD`.

## What this controls

- Draft, edit, publish, pause and delete (draft-only) Android releases.
- Stable and beta channels, optional required-update flag.
- Version, release notes, signed APK HTTPS URL and size verification. Paste-link APK size is entered in **MB** (0 if unknown) and converted to bytes for the existing API; uploaded APKs retain the exact byte size.
- Global update enable switch, automatic check switch, beta channel switch and GitHub repository URL.
- App releases remain **invisible until explicitly published**.
- RLS authorizes only active `owner`, `admin` or `release_manager` rows in `public.admin_members` to make changes. Signed-out users can only read *published* metadata.

## Setup

The connected Vercel project `animeplex-admin-control` already has the public client environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for preview builds. For local development, copy `.env.example` to `.env.local`, fill in a **publishable/anon** key (not service-role), then run:

```bash
npm install
npm run dev
npm test
npm run build
```

Sign in with an **existing Supabase Auth account that already has an active admin_members role**. This project deliberately does not embed default admin passwords or create unauthorized administrator accounts.

## Publishing an update

1. Sign in and open **Releases → New release**.
2. Enter a **higher version** than installed APK, release notes and a publicly reachable HTTPS **signed APK URL**. GitHub Releases assets work; private GitHub Actions artifacts and unsigned APKs do not.
3. Save draft, review, then **Publish**. Only then can the updated AnimePlex app display it.
4. Pause to stop offering it to additional users; disable the global switch for an emergency stop.

`app_releases` and old admin frontend code are not used. This project uses isolated `animeplex_update_*` tables with RLS. The Flutter app's `UpdateService` is their only update source after the paired app patch lands.

**Production domain is not changed by committing to `admin`.** Vercel Git integration may automatically create a preview deployment for the branch.
