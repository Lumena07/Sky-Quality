# Follow-up and CAP Timing (ICAO / Auric Air Manual)

This document describes how follow-up and Corrective Action Plan (CAP) timing are applied in Sky SQ QMS. Configure values to align with **ICAO** standards and your **Auric Air Manual**.

## Follow-up requirements

When a finding is created, the following must be completed before the finding can be closed:

- **Root cause** must be set and approved.
- **Corrective Action Plan (CAP)** must be submitted and approved.
- **Corrective Action Taken (CAT)** must be submitted and approved.

If any of these are missing or not approved, the system blocks closure and the finding appears in the **Follow-up** list (Dashboard and Findings page filter).

## CAP timing

- **P1:** CAP and root cause due within 24 hours; close-out within 7 days.
- **P2:** CAP and root cause within 2 weeks; close-out within 60 days.
- **P3:** CAP and root cause within 4 weeks; close-out within 90 days.

These defaults are defined in `lib/audit-deadlines.ts`. Adjust if your manual specifies different periods.

## Automated notifications

A scheduled job creates:

- **CAP_DUE_SOON** – when the CAP due date is within the next N days (default 3; set `CAP_DUE_SOON_DAYS` in environment).
- **CAP_OVERDUE** – when the CAP due date has passed and the finding is not closed.

Run the job daily (e.g. via Vercel Cron calling `GET /api/cron/cap-notifications` with `Authorization: Bearer <CRON_SECRET>`). Set `CRON_SECRET` in your environment.

## Configuration

| Variable | Description |
|----------|-------------|
| `CAP_DUE_SOON_DAYS` | Number of days before due date to send "due soon" notification (default: 3). |
| `CRON_SECRET` | Secret used to authorize the cron request to `/api/cron/cap-notifications`. |

Refer to **ICAO** and the **Auric Air Manual** when setting timing and escalation thresholds.
