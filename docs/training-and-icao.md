# Training and Qualifications (ICAO / Auric Air Manual)

Training and qualifications in Sky SQ QMS are maintained in line with **ICAO** standards and your **Auric Air Manual**. The Accountable Manager is part of Quality; Quality Manager and Auditors use ICAO and the manual for guidance.

## Module

- **Training & Qualifications** page: list training records, filter by user (managers), add/edit records.
- **Expiry**: set an expiry date on a record; the system sends **TRAINING_EXPIRY** notifications when expiry is within the configured window (default 30 days). Configure with `TRAINING_EXPIRY_WITHIN_DAYS` in the environment.
- **Cron**: run `GET /api/cron/training-expiry` (e.g. weekly via Vercel Cron) with `Authorization: Bearer <CRON_SECRET>` to create expiry notifications.

## Roles

- **Reviewers** (System Admin, Quality Manager, Auditor) and **Accountable Manager** can create, update, and delete training records for any user.
- **Staff** see only their own training records.

## Configuration

| Variable | Description |
|----------|-------------|
| `TRAINING_EXPIRY_WITHIN_DAYS` | Days before expiry to send notification (default: 30). |

Refer to ICAO and the Auric Air Manual when defining required training and qualification types and expiry rules.
