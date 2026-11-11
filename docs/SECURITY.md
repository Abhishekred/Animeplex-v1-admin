# Admin security baseline

The dashboard is currently a frontend preview. Do not connect it directly to privileged credentials.

## Required before enabling live controls
- Server-side authentication and authorization for every admin endpoint.
- Role-based permissions (Owner, Admin, Release Manager, Moderator, Read-only Auditor).
- Multi-factor authentication for privileged administrator accounts where supported.
- CSRF protection for cookie-authenticated mutations and strict CORS allowlists.
- Rate limits and request validation on login, upload and destructive endpoints.
- Audit records for account, configuration, release, backup and permission changes.
- Secrets stored only in trusted server environment variables or platform secret storage.
- Upload validation, SHA-256 verification and signed OTA manifests.
- No service-role key, private signing key or storage secret in frontend code or Git history.

## Dangerous actions
Require explicit confirmation and appropriate role permissions for publishing mandatory updates, enabling maintenance mode, suspending users, deleting content, restoring backups and changing administrator roles.
