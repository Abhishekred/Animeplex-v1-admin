# Vercel deployment

1. Import `Abhishekred/Animeplex-v1-admin` into Vercel.
2. Select the Vite framework preset.
3. Set build command to `npm run build`.
4. Set output directory to `dist`.
5. No environment variables are required for the current UI-only preview.
6. Deploy a preview first and inspect desktop, tablet and mobile layouts.

## Before production
- Add the trusted API origin as a server-side environment variable when the API is ready.
- Never expose Supabase service-role keys, storage credentials, OTA signing keys or admin secrets to browser bundles.
- Configure a separate production API and verify admin permissions on every privileged request.
- Test release upload limits, checksum verification, manifest signatures and audit records.
- Verify SPA deep-link routing after deployment.
