# Operations Runbook

## Purpose

This runbook covers safe database initialization, PostgreSQL backup and recovery, document-scanning configuration, and audit-log review for the AI Logistics Operations Copilot.

## Environment setup

1. Copy [`../.env.example`](../.env.example) to `.env`.
2. Replace every placeholder secret with a long, unique value.
3. Never commit `.env`; it is excluded by `.gitignore`.
4. For shared environments, provide a PostgreSQL `DATABASE_URL` to the backend and use PostgreSQL as the system of record.

## Schema initialization and migrations

The application runs its tracked schema bootstrap automatically at startup. It creates missing SQLAlchemy tables and records applied revisions in `schema_migrations`.

For a controlled manual initialization, run from `backend`:

```powershell
.\.venv\Scripts\python.exe -c "from app.db.session import init_db; init_db()"
```

Before every deployment, take a verified backup. After deployment, confirm the expected revision exists in `schema_migrations` and the service health endpoint returns healthy.

## PostgreSQL backup policy

Recommended baseline policy:

- Take one encrypted full backup each day and retain it for 35 days.
- Keep weekly backups for 12 weeks and monthly backups for 12 months.
- Take an on-demand backup before schema changes or imports.
- Store backups outside the application host with access restricted to authorized operators.
- Test restoration at least quarterly in a non-production environment.

For Docker Compose, create a compressed logical backup from the workspace:

```powershell
docker compose exec -T postgres pg_dump -U $env:POSTGRES_USER -d logistics_copilot | gzip > logistics_copilot_backup.sql.gz
```

The backup command should run only after `POSTGRES_USER` is loaded from a protected environment. Record the backup time, location, checksum, and operator in the deployment log.

## PostgreSQL restore procedure

1. Declare an incident and stop application writes.
2. Create a final backup of the affected database if it is still accessible.
3. Restore into an isolated recovery database first; never test a backup directly against production.
4. Validate row counts, key dashboards, recent alerts, and the expected migration revisions.
5. Obtain operator approval before switching the application to the recovered database.
6. Record the incident timeline, root cause, and preventive action.

Example recovery command for a verified logical backup:

```powershell
gzip -dc logistics_copilot_backup.sql.gz | docker compose exec -T postgres psql -U $env:POSTGRES_USER -d logistics_copilot
```

## Document scanning

Uploads are restricted to Markdown, text, and PDF files, capped at 10 MB, and saved outside the official SOP directory. In production:

1. Run a managed ClamAV daemon or equivalent scanning service.
2. Set `DOCUMENT_SCAN_REQUIRED=true`.
3. Set `CLAMAV_HOST` and `CLAMAV_PORT` to that service.
4. Confirm that a scan-service outage blocks uploads. This fail-closed behavior is intentional.

The app rejects files reported as infected and refuses uploads when required scanning is unavailable or gives an unexpected result.

## Audit-log review

The `audit_logs` table records successful sign-ins, SQL Copilot use and rejections, RAG queries, agent tasks, document uploads, alert resolution, and manual workflow triggers. Query metadata intentionally stores operational facts such as query length and result counts, not raw user prompts.

Review at least weekly for:

- repeated denied or rejected SQL requests;
- unexpected document uploads;
- workflow triggers outside approved operations windows;
- unusual patterns of alert resolution;
- user access inconsistent with assigned responsibilities.

## Incident response

For security-sensitive incidents:

1. Preserve relevant audit logs and service logs.
2. Revoke/rotate application secrets if compromise is suspected.
3. Disable document uploads by setting `DOCUMENT_SCAN_REQUIRED=true` until a scanner is available.
4. Restrict access at the reverse proxy or application layer if an account is suspected to be compromised.
5. Document remediation and verify normal behavior in staging before re-enabling affected functions.
