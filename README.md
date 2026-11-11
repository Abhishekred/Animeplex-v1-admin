# AnimePlex Admin — Control Center

A standalone, responsive administration dashboard for AnimePlex. This repository is being developed and reviewed independently before any integration with **AnimePlex-V1**.

## Stack
- React 18 + Vite
- Recharts analytics
- Lucide React icons
- Vercel-ready static frontend

## Run locally
```bash
npm install
npm run dev
```

Create a production build:
```bash
npm run build
npm run preview
```

## Current UI
- Responsive dashboard shell with searchable sidebar navigation
- Overview cards, audience chart, service health and activity feed
- OTA release center with release history and create-release modal
- Navigation shells for users, devices, content, announcements, release channels, app configuration, system health, backups, audit logs, admin access and settings
- Dark/light theme toggle
- Mobile navigation and preview-mode notifications

## Important: preview mode
Metrics and release rows currently use illustrative sample data. Forms and buttons are UI previews only. No live user, server, storage, database, or OTA action is performed yet. The dashboard must not be treated as a production control panel until the secure API layer and authorization checks are implemented.

## OTA security design
Production release publishing will require:
- Server-side admin authorization and role checks
- APK/AAB type and size validation
- Version-code validation
- SHA-256 checksum generation and verification
- Signed release manifests
- Stable/Beta/Testing channels and staged rollout
- Audit logging and safe rollout stop/rollback controls

Android installation must use the platform-supported installation flow and user/device authorization. Do not assume silent installation or automatic downgrade is available.

## Deployment on Vercel
Import this repository into Vercel. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. No environment variables are needed for the current UI preview.

## Project documentation
- [Project plan and architecture](docs/PROJECT_PLAN.md)
- [Deployment guide](docs/DEPLOYMENT_VERCEL.md)
- [Change log](docs/CHANGELOG.md)
- [Security requirements](docs/SECURITY.md)

## Integration boundary
AnimePlex-V1 is intentionally untouched. Once the admin UI is reviewed and the API contract is finalized, integration will be planned separately.
