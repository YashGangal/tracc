# Phase 3 Integration Decisions

**Recorded:** 2026-09-06

| Area | Decision | Implementation status |
|---|---|---|
| Notifications | Slack | Deferred by request; no Slack app, webhook, or message connection has been created. |
| Future Slack destination | `#logistics-ops` | Recorded as the intended target for a later notification integration. |
| Daily report schedule | 07:00, Monday–Friday | Configured with a weekday cron expression. |
| Daily report timezone | `America/New_York` | Configured for n8n through `GENERIC_TIMEZONE`. |
| Power BI delivery | Existing CSV exports | Accepted for now; no Power BI workspace/report integration is required in this phase. |
| AI provider | OpenAI | Configured as the selected provider. |
| AI model | `gpt-4o-mini` | Configured as the selected OpenAI model. |
| OpenAI key | To be supplied later | The app uses its offline demo fallback until `OPENAI_API_KEY` is available. |
| Staging services | PostgreSQL and n8n later | Deferred to Phase 5 staging verification. |

## Required later

- Add `OPENAI_API_KEY` to a protected `.env` file or deployment secret store before using live OpenAI responses.
- When Slack is approved, create a Slack app/webhook with least-privilege access for `#logistics-ops`; do not use a personal token.
- Verify the n8n server timezone and weekday schedule in staging after n8n is available.
