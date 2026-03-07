# Manual test checklist – Sky Quality QMS features

Use this list to verify that all requested features work end-to-end.  
**Prerequisites:** `.env` configured (Supabase + `CRON_SECRET`), migrations applied, at least one user with **ACCOUNTABLE_MANAGER** (see [ENV_AND_AM_SETUP.md](./ENV_AND_AM_SETUP.md)).

---

## 1. Prerequisites

| # | Step | Expected |
|---|------|----------|
| 1.1 | Run app: `npm run dev` | App loads at e.g. `http://localhost:3000` |
| 1.2 | Log in as a user with **Quality Manager** or **System Admin** | Dashboard and sidebar load |
| 1.3 | Ensure at least one user has **ACCOUNTABLE_MANAGER** (Admin → Edit user → Roles) | AM can log in and see AM Dashboard link |

---

## 2. Follow-up (root cause + CAP before closure)

| # | Step | Expected |
|---|------|----------|
| 2.1 | **Dashboard:** Open main Dashboard | A card **“Needs Follow-up”** is visible (with link to findings) |
| 2.2 | Click **“Needs Follow-up”** (or go to Findings and choose **Follow-up** filter) | URL contains `?needsFollowUp=true`; list shows only findings that need follow-up (open, missing/not approved root cause or CAP, or overdue) |
| 2.3 | Open a finding that has **no root cause** or **root cause not approved** | Root cause section is editable (if you’re assignee) or visible for review |
| 2.4 | As reviewer: approve root cause; ensure CAP exists and approve CAP | Both show as approved |
| 2.5 | As reviewer: try to **close** the finding (approve CAT / set status to Closed) **before** root cause and CAP are both approved | Request is **rejected** with message that root cause and CAP must be set and approved first |
| 2.6 | After root cause and CAP are both approved, approve CAT / close finding | Finding can be closed; it no longer appears in “Needs Follow-up” |

---

## 3. Escalation to Accountable Manager

| # | Step | Expected |
|---|------|----------|
| 3.1 | Ensure **CRON_SECRET** is set and (optional) create a CAP that is overdue by more than `ESCALATION_CAP_OVERDUE_DAYS` (default 7) | — |
| 3.2 | Call cron: `GET /api/cron/escalate-to-am` with header `Authorization: Bearer <CRON_SECRET>` (e.g. via curl or Postman) | Response **200**; no 401 |
| 3.3 | Log in as a user with **ACCOUNTABLE_MANAGER** | Notifications show **“Escalation to AM”** (or similar) for escalated findings |
| 3.4 | Open **AM Dashboard** (sidebar) | Escalations and overdue CAPs are listed (or empty if none) |

---

## 4. Accountable Manager dashboard

| # | Step | Expected |
|---|------|----------|
| 4.1 | Log in as **ACCOUNTABLE_MANAGER** (or Admin/QM/Auditor) | Sidebar shows **“AM Dashboard”** |
| 4.2 | Open **AM Dashboard** | Page loads; shows sections for escalations, overdue CAPs, open findings count, open by department (or placeholders) |
| 4.3 | Click link to **findings that need follow-up** (if present) | Navigates to Findings with `?needsFollowUp=true` |
| 4.4 | Log in as **Staff** (no AM, no reviewer role) | **AM Dashboard** does **not** appear in sidebar |
| 4.5 | As Staff, open URL `/dashboard/am` directly | Access denied or redirect (no AM data) |

---

## 5. Training and qualifications

| # | Step | Expected |
|---|------|----------|
| 5.1 | Log in as any role that has **Training** in sidebar | **Training** link visible; open **Training & Qualifications** page |
| 5.2 | Page loads | List of training records (or empty); filters/table with type, expiry, user, etc. |
| 5.3 | **Create** a new training record (e.g. type **Training**, course name, expiry date, assign to user) | Record is created and appears in the list; no “column type does not exist” error |
| 5.4 | **Edit** an existing record (e.g. change expiry or status) | Changes save correctly |
| 5.5 | Call cron: `GET /api/cron/training-expiry` with `Authorization: Bearer <CRON_SECRET>` | Response **200**; users with expiry within `TRAINING_EXPIRY_WITHIN_DAYS` receive **Training expiry** notifications (check Notifications page) |

---

## 6. Performance dashboard

| # | Step | Expected |
|---|------|----------|
| 6.1 | Log in as **Quality Manager**, **System Admin**, **Auditor**, or **Accountable Manager** | Sidebar shows **“Performance”** |
| 6.2 | Open **Performance** | Page loads; shows performance metrics (e.g. audits, findings, CAP) for a selected period |
| 6.3 | Change period (e.g. **7d**, **30d**, **90d**) | Data refreshes for the selected period |
| 6.4 | Log in as **Staff** only | **Performance** does **not** appear in sidebar |

---

## 7. Activity log (Angalia)

| # | Step | Expected |
|---|------|----------|
| 7.1 | Log in as **Quality Manager**, **System Admin**, **Auditor**, or **Accountable Manager** | Sidebar shows **“Activity Log”** |
| 7.2 | Open **Activity Log** | Page loads; list of activity entries (or empty) |
| 7.3 | Perform an action that creates activity (e.g. create finding, approve CAP) | New entry appears in Activity Log (after refresh or auto-refresh) |
| 7.4 | Log in as **Staff** only | **Activity Log** does **not** appear in sidebar |
| 7.5 | As Staff, open `/activity-log` directly | Access denied or redirect (403 from API) |
| 7.6 | Log out and open `/activity-log` in browser | Redirect to **login** (middleware protects route) |

---

## 8. Cron endpoints (optional)

| # | Step | Expected |
|---|------|----------|
| 8.1 | Call `GET /api/cron/cap-notifications` **without** `Authorization: Bearer <CRON_SECRET>` | **401** Unauthorized |
| 8.2 | Call with correct header | **200**; CAP due soon / overdue notifications sent as configured |
| 8.3 | Call `GET /api/cron/escalate-to-am` without secret | **401** |
| 8.4 | Call `GET /api/cron/training-expiry` without secret | **401** |

---

## 9. Notifications and dashboard labels

| # | Step | Expected |
|---|------|----------|
| 9.1 | Open **Notifications** page | Notifications list loads |
| 9.2 | Trigger **CAP due soon** or **CAP overdue** (cron or data setup) | Notifications show **“CAP due soon”** / **“CAP overdue”** |
| 9.3 | Trigger **Escalation to AM** (cron) | Notifications show **“Escalation to AM”** |
| 9.4 | Trigger **Training expiry** (cron) | Notifications show **“Training expiry”** |
| 9.5 | Main Dashboard notification type labels | **ESCALATION_TO_AM**, **TRAINING_EXPIRY**, **CAP_DUE_SOON**, **CAP_OVERDUE** display with correct labels |

---

## 10. Admin – Accountable Manager role

| # | Step | Expected |
|---|------|----------|
| 10.1 | Log in as **System Admin** or **Quality Manager** → **Admin** | User list and edit available |
| 10.2 | Edit a user → **Roles** | **ACCOUNTABLE MANAGER** (or equivalent) option is present |
| 10.3 | Assign **ACCOUNTABLE MANAGER** and save | User’s roles include AM; that user can access AM Dashboard and receive escalations |

---

## 11. Audit schedule, meetings, reschedule and send to auditee

| # | Step | Expected |
|---|------|----------|
| 11.1 | **Audits** → Create a new audit (non-ERP) | Form includes optional **Opening meeting**, **Closing meeting** (datetime), and **Schedule notes** |
| 11.2 | Open an existing planned audit → **Audit Schedule** tab | Schedule shows opening/closing date-time and notes (or “No schedule details yet”) |
| 11.3 | As QM/Auditor: click **Edit schedule** or **Reschedule** (Overview) | Dialog opens with start/end date, opening/closing meeting, schedule notes; **Save** updates audit and (if dates changed) auditees receive “Audit rescheduled” notification |
| 11.4 | On **Audit Schedule** tab (audit PLANNED, checklist selected): click **Send checklist & schedule to auditee** | Success message; auditees receive in-app notification with link to the audit |
| 11.5 | **Start Audit** (Overview) | Audit status becomes ACTIVE; **Opening Meeting** and **Closing Meeting** tabs appear |
| 11.6 | Open **Opening Meeting** tab | Shows date/time from schedule; **Attendance** section with table; auditors can **Add** attendee (name, role) and **Sign** per row |
| 11.7 | Add attendees and click **Sign** for one row | Row shows signed timestamp; list refreshes |
| 11.8 | Open **Closing Meeting** tab | Shows closing date/time, findings summary, **Closing meeting notes** (editable by auditor/QM with **Save notes**), and **Attendance** list (same add/sign pattern as Opening) |
| 11.9 | Edit closing meeting notes and click **Save notes** | Notes persist after refresh |

---

## 12. Auditee extension request (Root cause / CAP / CAT due dates)

| # | Step | Expected |
|---|------|----------|
| 12.1 | Open a finding as **assignee** (auditee) | **Extension requests** card visible with **Request extension** button |
| 12.2 | Click **Request extension**; enter **Reason**, optional **Requested CAP due date** and **Requested close-out due date**; **Submit** | Request is created with status PENDING; reviewers receive notification |
| 12.3 | As **reviewer** (QM/Auditor/Admin): open same finding | Extension request listed with **Approve** and **Reject** |
| 12.4 | Click **Approve** | Request status APPROVED; finding’s CAP/close-out due dates update if requested; assignee receives “Extension approved” notification |
| 12.5 | Create another extension request; as reviewer click **Reject**, optionally add notes; confirm | Request status REJECTED; assignee sees rejection and review notes |

---

## Quick reference – roles and visibility

| Feature | Staff | Auditor | QM / Admin | AM (only) |
|--------|--------|---------|------------|-----------|
| Dashboard, Findings, Documents, Training | ✓ | ✓ | ✓ | ✓ |
| Needs Follow-up (filter + card) | assignee only for findings | ✓ | ✓ | ✓ |
| AM Dashboard | ✗ | ✓ | ✓ | ✓ |
| Performance | ✗ | ✓ | ✓ | ✓ |
| Activity Log | ✗ | ✓ | ✓ | ✓ |
| Admin | ✗ | ✗ | ✓ | ✗ |
| Audit schedule, Opening/Closing meetings, Reschedule, Send to auditee | auditee: view; auditor: full | ✓ | ✓ | ✓ |
| Extension request (submit) | assignee only | assignee | assignee | — |
| Extension request (approve/reject) | ✗ | ✓ | ✓ | ✓ |

---

*After running through this checklist, all requested features including Audit schedule, Opening/Closing meetings, Reschedule, Send to auditee, and Extension requests should be verified.*
