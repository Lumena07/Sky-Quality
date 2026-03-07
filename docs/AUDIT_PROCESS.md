# Audit process – schedule, meetings, and extensions

This document describes how audits are scheduled, how opening and closing meetings work, and how auditees can request extensions for Root cause, CAP, and CAT due dates. Align with your internal manual and ICAO / Auric Air requirements as needed.

---

## 1. Schedule an audit

- **Create audit** (Audits → Create): Set title, scope, department, base, start/end date, auditors, auditees. Optionally set **Opening meeting** and **Closing meeting** date/time and **Schedule notes** (process steps from the manual).
- **Audit Schedule** tab (on the audit detail page) shows the full schedule. While the audit is **PLANNED**, auditors or QM/Admin can **Edit schedule** or use **Reschedule** from Overview to change start/end dates and meeting times.
- **Send checklist & schedule to auditee**: From the Audit Schedule tab (audit PLANNED, checklist selected), click **Send checklist & schedule to auditee**. All auditees with user accounts receive an in-app notification with a link to the audit so they can review the checklist and schedule before the audit.

---

## 2. Start the audit

- The audit remains **PLANNED** until someone with edit rights (auditor or QM/Admin) clicks **Start Audit** on the Overview tab. A checklist must be selected before starting.
- After **Start Audit**, the status becomes **ACTIVE**. The **Opening Meeting**, **Execution**, and **Closing Meeting** tabs become available (in addition to **Audit Schedule**, **Checklist**, **Findings**, **Team**).

---

## 3. Opening meeting

- **Opening Meeting** tab shows the opening meeting date/time (from the audit schedule) and an **Attendance** list.
- Auditors can **Add** attendees (name, role/title). Each attendee can be marked as **Signed** (sign-off). Attendance and sign-off are stored per audit for the opening meeting.
- Use this to record who attended the opening meeting and to capture sign-off as required by your process.

---

## 4. Execution and findings

- With the audit **ACTIVE**, use the **Checklist** and **Execution** tabs to run the audit and record compliance. Findings can be added from the checklist/execution flow.
- All findings appear under the **Findings** tab. Each finding has due dates for Root cause, CAP, and CAT (close-out) based on priority (see [follow-up-and-icao.md](./follow-up-and-icao.md)).

---

## 5. Closing meeting

- **Closing Meeting** tab shows the closing meeting date/time (from the audit schedule), a short **Findings summary**, **Closing meeting notes** (editable by auditor/QM), and an **Attendance** list.
- Use **Closing meeting notes** to record the discussion, action items, or closing timeline. Use **Attendance** to record who attended the closing meeting and to record sign-off (same add/sign pattern as the opening meeting).

---

## 6. Reschedule

- From **Overview** or **Audit Schedule**, auditors or QM/Admin can click **Reschedule** (for PLANNED or ACTIVE audits). The dialog allows changing:
  - Audit **Start date** and **End date**
  - **Opening meeting** and **Closing meeting** date/time
  - **Schedule notes**
- On save, the audit is updated. If start or end date changed, all auditees with user accounts receive an **Audit rescheduled** notification.

---

## 7. Extension requests (Root cause / CAP / CAT due dates)

- **Auditee (assignee)** can request an extension for CAP and/or close-out due dates from the **Finding** detail page:
  - Open the finding → **Extension requests** card → **Request extension**.
  - Enter **Reason** (required) and optionally **Requested CAP due date** and **Requested close-out due date** → **Submit**.
- **Reviewers** (QM, Admin, Auditor) see pending extension requests on the same finding and can:
  - **Approve**: The finding’s CAP and/or close-out due dates are updated to the requested dates; the assignee is notified.
  - **Reject**: Optionally add **Review notes**; the assignee sees the rejection and notes.
- Only one approval flow is implemented: approving an extension request updates the finding (and Corrective Action due date if applicable). Rejected requests remain visible for reference.

---

## Quick reference

| Step | Who | Where |
|------|-----|--------|
| Create audit, set schedule | QM / Admin / Auditor | Audits → Create; Audit Schedule tab |
| Send checklist & schedule to auditee | QM / Admin / Auditor | Audit Schedule tab (PLANNED audit) |
| Start audit | QM / Admin / Auditor | Overview → Start Audit |
| Opening meeting attendance & sign-off | Auditor / QM / Admin | Opening Meeting tab |
| Add findings | Auditor / QM / Admin | Execution / Checklist |
| Closing meeting notes & attendance | Auditor / QM / Admin | Closing Meeting tab |
| Reschedule | QM / Admin / Auditor | Overview or Audit Schedule → Reschedule |
| Request extension | Assignee (auditee) | Finding detail → Extension requests |
| Approve / reject extension | QM / Admin / Auditor | Finding detail → Extension requests |
