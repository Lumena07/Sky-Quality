# Environment variables and Accountable Manager setup

## 1. Environment variables

### Local development (`.env` in project root)

Add these to your existing `.env` (do not commit secrets):

```env
# Required for cron routes (use a long random string; e.g. openssl rand -base64 32)
CRON_SECRET=your-secret-here

# Optional – defaults are fine for most cases
# CAP_DUE_SOON_DAYS=3
# ESCALATION_CAP_OVERDUE_DAYS=7
# TRAINING_EXPIRY_WITHIN_DAYS=30
```

- **CRON_SECRET**: Required if you call the cron endpoints (e.g. from Vercel Cron or a scheduler). Use a strong random value. The cron routes check `Authorization: Bearer <CRON_SECRET>`.
- **CAP_DUE_SOON_DAYS**: Days before CAP due date to send “CAP due soon” notification (default: 3).
- **ESCALATION_CAP_OVERDUE_DAYS**: Days CAP is overdue before escalating to Accountable Manager (default: 7).
- **TRAINING_EXPIRY_WITHIN_DAYS**: Days before training/qualification expiry to send notification (default: 30).

### Vercel

1. Open your project in [Vercel](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add:
   - **CRON_SECRET**: value from e.g. `openssl rand -base64 32` (Production, Preview, Development as needed).
   - Optionally add **CAP_DUE_SOON_DAYS**, **ESCALATION_CAP_OVERDUE_DAYS**, **TRAINING_EXPIRY_WITHIN_DAYS**.
3. Save and redeploy so the cron jobs use the new variables.

Vercel Cron will send requests to your app with the configured schedule; the app uses `CRON_SECRET` to allow those requests.

### Other hosts

Set the same variables in your platform’s env/config (e.g. Railway, Render, Docker). If you use an external cron (e.g. cron-job.org), call:

- `GET https://your-domain.com/api/cron/cap-notifications`  
- `GET https://your-domain.com/api/cron/escalate-to-am`  
- `GET https://your-domain.com/api/cron/training-expiry`  

with header: `Authorization: Bearer <your CRON_SECRET>`.

---

## 2. Assign Accountable Manager (AM)

At least one user must have the **ACCOUNTABLE_MANAGER** role so they receive escalations and can use the AM Dashboard.

### Option A: Admin UI (recommended)

1. Log in as a **System Admin** or **Quality Manager**.
2. Open **Admin** from the sidebar.
3. Find the user who should be the Accountable Manager (or create a new user).
4. Click **Edit** for that user.
5. In **Roles**, check **ACCOUNTABLE MANAGER** (and leave any other roles they need, e.g. Quality Manager).
6. Save.

That user will now see **AM Dashboard** and receive **Escalation to AM** notifications.

### Fix: "invalid input value for enum UserRole: ACCOUNTABLE_MANAGER"

If you see this when adding or editing a user as Accountable Manager, the database enum is missing the value. In **Supabase Dashboard → SQL Editor**, run once:

```sql
ALTER TYPE public."UserRole" ADD VALUE 'ACCOUNTABLE_MANAGER';
```

(If you get "already exists", the value is already there and you can ignore it.)

---

### Option B: Supabase (SQL)

1. In Supabase Dashboard go to **SQL Editor**.
2. Run (replace `user_id_here` with the real User id, or use email):

```sql
-- By user id
UPDATE "User"
SET "roles" = COALESCE("roles", '[]'::jsonb) || '"ACCOUNTABLE_MANAGER"'::jsonb
WHERE id = 'user_id_here';

-- Or by email
UPDATE "User"
SET "roles" = COALESCE("roles", '[]'::jsonb) || '"ACCOUNTABLE_MANAGER"'::jsonb
WHERE email = 'am@yourcompany.com';
```

If the user should have **only** the AM role (no other roles), set the array explicitly:

```sql
UPDATE "User"
SET "roles" = '["ACCOUNTABLE_MANAGER"]'::jsonb
WHERE email = 'am@yourcompany.com';
```

3. If your app reads the legacy **role** column as well, set it for consistency:

```sql
UPDATE "User"
SET "role" = 'ACCOUNTABLE_MANAGER'
WHERE email = 'am@yourcompany.com';
```

After this, that user can use the AM Dashboard and will receive escalation notifications when the cron runs.
