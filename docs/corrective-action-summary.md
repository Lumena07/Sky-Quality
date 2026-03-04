# Root cause, corrective action plan, and approval

## Where they are saved

| Data | Table | Column | When it’s written |
|------|--------|--------|-------------------|
| **Root cause** | **Finding** | `rootCause` | Only when **creating** a finding: `POST /api/findings` and `POST /api/audits/[id]/checklist/create-finding`. Never updated later (no PATCH for rootCause). |
| **Corrective action plan (CAP)** | **CorrectiveAction** | `actionPlan` | Only when **creating** a finding **with** an action plan: same two POSTs above. They insert a CorrectiveAction row with `actionPlan`, `dueDate`, `responsibleId`, `status`. Never updated later (no PATCH for CorrectiveAction). |

So today:
- **Root cause** is on **Finding** and only set at creation.
- **CAP** is on **CorrectiveAction** and only set at creation (when `actionPlan` is provided).

## Approval (for root cause / CAP)

The **CorrectiveAction** table already has approval fields:

- `managementApproval` (Boolean, default false)
- `approvedBy` (User id)
- `approvedAt` (DateTime)

**None of these are ever set in the app.** No API or form updates CorrectiveAction (no PATCH/PUT). The finding detail page only **displays** “✓ Approved” when `correctiveAction.managementApproval` is true, but nothing in the codebase sets it to true.

So for “root cause and corrective action plans need to be approved” you will need to add:

1. **APIs** that can update:
   - **Finding**: e.g. `rootCause` (and optionally when it was entered).
   - **CorrectiveAction**: e.g. `actionPlan` if it can be edited, and **approval**: `managementApproval`, `approvedBy`, `approvedAt` when someone approves.
2. **UI** for:
   - Entering/editing root cause (and CAP if desired).
   - An “Approve” action (e.g. button) that calls an endpoint that sets `managementApproval`, `approvedBy`, `approvedAt` on the CorrectiveAction (and possibly guards so only certain roles can approve).

---

## CorrectiveAction table definition (from Prisma)

The app uses **Prisma** for the schema; there is no separate `CorrectiveAction` SQL file in the repo. The table is defined in `prisma/schema.prisma` as:

```prisma
model CorrectiveAction {
  id                    String    @id @default(cuid())
  findingId             String    @unique
  actionPlan            String
  correctiveActionTaken String?   // What corrective action was actually taken (CAT)
  responsibleId         String
  dueDate               DateTime
  completionDate        DateTime?
  evidenceUrl           String?
  managementApproval     Boolean   @default(false)
  approvedBy            String?
  approvedAt            DateTime?
  status                FindingStatus @default(IN_PROGRESS)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  finding     Finding  @relation(...)
  responsible User     @relation(...)
  attachments CAPAttachment[]
  activityLogs ActivityLog[]
}
```

**CAT (Corrective Action Taken)** is the field **`correctiveActionTaken`** — optional text for what was actually done.

---

## 2. Equivalent SQL (Postgres)

If you create or align the table in Postgres (e.g. Supabase) without Prisma, you can use:

```sql
CREATE TABLE IF NOT EXISTS "CorrectiveAction" (
  "id"                    TEXT PRIMARY KEY,
  "findingId"             TEXT NOT NULL UNIQUE,
  "actionPlan"            TEXT NOT NULL,
  "correctiveActionTaken" TEXT,
  "responsibleId"         TEXT NOT NULL,
  "dueDate"               TIMESTAMP(3) NOT NULL,
  "completionDate"         TIMESTAMP(3),
  "evidenceUrl"           TEXT,
  "managementApproval"    BOOLEAN NOT NULL DEFAULT false,
  "approvedBy"            TEXT,
  "approvedAt"            TIMESTAMP(3),
  "status"                TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CorrectiveAction_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE,
  CONSTRAINT "CorrectiveAction_responsibleId_fkey"
    FOREIGN KEY ("responsibleId") REFERENCES "User"("id")
);

CREATE INDEX "CorrectiveAction_findingId_idx" ON "CorrectiveAction"("findingId");
CREATE INDEX "CorrectiveAction_responsibleId_idx" ON "CorrectiveAction"("responsibleId");
CREATE INDEX "CorrectiveAction_dueDate_idx" ON "CorrectiveAction"("dueDate");
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");
```

(If your DB uses snake_case, the column would be `corrective_action_taken` and you’d need to map it in your API layer.)

---

## 3. Where CorrectiveAction rows are **inserted**

Rows are only **created** in two places, and **only when an action plan is provided**:

| Location | When | Fields set |
|----------|------|------------|
| `app/api/audits/[id]/checklist/create-finding/route.ts` | Creating a finding from a checklist item (body includes `actionPlan`) | `findingId`, `actionPlan`, `responsibleId`, `dueDate`, `status: 'IN_PROGRESS'` |
| `app/api/findings/route.ts` | Creating a finding via POST /api/findings (body includes `actionPlan`) | `findingId`, `actionPlan`, `responsibleId`, `dueDate`, `status: 'IN_PROGRESS'` |

In both places the insert looks like:

```ts
await supabase.from('CorrectiveAction').insert({
  findingId: finding.id,
  actionPlan,
  responsibleId: assignedToId,
  dueDate: ...,
  status: 'IN_PROGRESS',
})
```

So **`correctiveActionTaken` (CAT) is never set on insert** — it’s only defined in the schema.

---

## 4. Where CAT is **not** written

- There is **no** PATCH/PUT (or other) API that updates `CorrectiveAction` in this repo.
- So **corrective action taken (CAT)** is **never written** anywhere yet; the column exists but no code sets it.

To support CAT you would need for example:

- A PATCH endpoint for CorrectiveAction (e.g. `PATCH /api/findings/[id]/corrective-action` or similar) that accepts `correctiveActionTaken` (and optionally `completionDate`, etc.), or
- A form on the finding detail page that submits an update including `correctiveActionTaken`, calling that API.

---

## 5. Where CorrectiveAction is **read**

- **Audit detail:** `app/api/audits/[id]/route.ts` — audit fetch includes `Findings:Finding(*, ..., CorrectiveAction(*))`.
- **Finding by id:** `app/api/findings/[id]/route.ts` — includes `CorrectiveAction(..., Attachments:CorrectiveActionAttachment(*))`.
- **Findings list:** `app/api/findings/route.ts` — list includes `CorrectiveAction(*)`.
- **UI:** e.g. `app/audits/[id]/page.tsx` (findings table), `app/findings/[id]/page.tsx` (finding detail) use `finding.CorrectiveAction` / `finding.correctiveAction` (actionPlan, dueDate, status, etc.). None of them display or edit `correctiveActionTaken` yet.

So the table and the CAT field exist in the schema (and in SQL if you use the snippet above), but **CAT is only defined, not written or shown in the app** until you add an update API and UI for it.
