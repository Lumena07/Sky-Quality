# Supabase Seed Data Instructions

## Overview
This guide explains how to seed your Supabase database with departments and users after data loss.

## Files Created

1. **`supabase_seed_data.sql`** - Main seed script with departments and users
2. **`supabase_auditee_migration.sql`** - Migration to support external auditees

## Step-by-Step Instructions

### Step 1: Run the Auditee Migration (if needed)
If you need to support external auditees (people not in the User table):

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase_auditee_migration.sql`
4. Run the script

This will:
- Make `userId` nullable in `AuditAuditee` table
- Add `name` and `email` columns for external auditees
- Update constraints to allow external auditees

### Step 2: Seed Departments and Users

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase_seed_data.sql`
4. Run the script

This will create:
- **6 Departments**: Operations, Maintenance, Quality, Ground Operations, Safety, Training
- **16 Users**:
  - 1 System Admin
  - 2 Quality Managers
  - 4 Auditors
  - 3 Department Heads
  - 6 Staff members (potential auditees)

### Step 3: Verify Data

Run this query to verify:

```sql
SELECT COUNT(*) as dept_count FROM "Department";
SELECT COUNT(*) as user_count FROM "User";
```

You should see:
- `dept_count`: 6
- `user_count`: 16

## Default Login Credentials

**Email**: `admin@skysq.com`  
**Password**: `password123`

All users have the same default password: `password123`

## Adding External Auditees

After running the migration, you can add external auditees (people not in the User table) when creating an audit:

### Option 1: Via API
When creating an audit via API, include `externalAuditees` array:

```json
{
  "title": "Audit Title",
  "auditorIds": ["user_auditor_001"],
  "auditeeIds": ["user_staff_001"],  // Internal users
  "externalAuditees": [              // External people
    {
      "name": "John External",
      "email": "john.external@example.com"
    }
  ]
}
```

### Option 2: Via SQL
You can manually add external auditees to an audit:

```sql
INSERT INTO "AuditAuditee" (id, "auditId", "userId", name, email, "createdAt")
VALUES (
  'auditee_ext_001',
  'your_audit_id_here',
  NULL,  -- NULL for external auditees
  'External Person Name',
  'external@example.com',
  CURRENT_TIMESTAMP
);
```

## Adding More Users

To add more users, use this template:

```sql
INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "departmentId", position, "isActive", "createdAt", "updatedAt")
VALUES (
  'user_unique_id',
  'email@example.com',
  '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi',  -- password123
  'First',
  'Last',
  'AUDITOR',  -- or 'QUALITY_MANAGER', 'DEPARTMENT_HEAD', 'STAFF', 'SYSTEM_ADMIN'
  'dept_quality_001',  -- Department ID
  'Position Title',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
```

**To change passwords:**
1. Generate a new bcrypt hash at: https://bcrypt-generator.com/
2. Enter your desired password
3. Set rounds to 10
4. Replace the password hash in the INSERT statement

## Troubleshooting

### Error: "relation does not exist"
- Make sure you've run the Prisma migrations first
- Check that table names match your schema (case-sensitive in PostgreSQL)

### Error: "duplicate key value"
- The `ON CONFLICT (email) DO NOTHING` clause prevents duplicates
- If you see this error, the user already exists

### Passwords not working
- Verify the bcrypt hash is correct
- Make sure you're using the exact hash from the seed file
- Try generating a new hash if needed

## Next Steps

1. Run the seed script
2. Test login with `admin@skysq.com` / `password123`
3. Create audits and test the external auditee functionality
4. Add more users as needed
