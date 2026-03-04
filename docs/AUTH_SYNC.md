# Why "Authentication → Users" Shows No Users

Supabase has **two separate** places for user data:

| Location | Purpose | Where you see it |
|----------|--------|-------------------|
| **`auth.users`** | Who can sign in (passwords, sessions). Used by `signInWithPassword`. | Dashboard → **Authentication → Users** |
| **`public."User"`** | Your app’s profile/role data (name, role, department, etc.). | Your DB tables + `/api/users` |

Your seed script only inserted into **`public."User"`**. It never created any rows in **`auth.users`**, so:

- **Authentication → Users** correctly shows “no users”.
- **Login fails** because `signInWithPassword` only checks `auth.users`.

To fix it you need to:

1. **Create auth users** (so they appear in Authentication and can log in).
2. **Sync `public."User"` with auth** so `User.id` = `auth.users.id` (your app uses `session.user.id` everywhere).

Follow the steps in **“Fix: Sync Auth and User table”** below.

---

## Fix: Sync Auth and User Table

### 1. Get your service role key

- In Supabase: **Project Settings → API**.
- Copy **service_role** (secret). Never use it in the browser or commit it.

Add to `.env` (and keep it server-only):

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. Create auth users from your User table

From the project root:

```bash
npm run sync-auth-users
```

(Or run `node -r dotenv/config scripts/sync-auth-users.mjs`; ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in `.env` or your environment.)

This script:

- Reads `public."User"` (with the service role client).
- For each row, creates an auth user with the **same email** and password **`password123`** (email confirmed).
- Does **not** change `public."User"` or any other table.

Default password for all created auth users: **`password123`**.

### 3. Run the migration in Supabase

After the script has created auth users:

1. Open **Supabase Dashboard → SQL Editor**.
2. Run the contents of **`migration_sync_user_to_auth.sql`**.

That migration:

- Updates every table that references `User.id` so those columns use `auth.users.id` (matched by email).
- Then updates `public."User"` so `User.id` = `auth.users.id` for the same email.

After this, the same UUID is used for:

- Supabase Auth (login, session, Dashboard → Authentication → Users).
- Your app (APIs, `User` table, foreign keys).

### 4. Verify

- **Dashboard → Authentication → Users**: you should see one row per seeded email.
- **Login**: e.g. `admin@skysq.com` / `password123` should work.
- **App**: creating audits, checklists, etc. should work without changes because they already use `session.user.id`.

---

## Optional: Add new users in the future

- **Option A:** Create the user in **Authentication → Users** (or via `auth.admin.createUser`), then insert a row in **`public."User"`** with the **same `id`** (the auth user’s UUID) and the same email, plus role/department/etc.
- **Option B:** Add a sign-up flow in the app that calls `supabase.auth.signUp()` and a trigger or API that inserts into `public."User"` with `id = auth.uid()` and the same email.

Keeping **`User.id` = `auth.users.id`** avoids the “two user stores” confusion and keeps the dashboard and your app in sync.
