# Quick Start Testing Guide

## 5-Minute Quick Test

### Step 1: Setup (2 minutes)

```bash
# Install dependencies
npm install

# Create .env file
echo 'DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="test-secret-key"
NEXTAUTH_URL="http://localhost:3000"' > .env

# Setup database
npm run db:generate
npm run db:push
npm run db:seed

# Start server
npm run dev
```

### Step 2: Login (30 seconds)

1. Open: http://localhost:3000
2. Login with:
   - Email: `admin@skysq.com`
   - Password: `password123`

### Step 3: Quick Feature Test (2 minutes)

#### Test 1: Create Audit (30 seconds)
1. Click **"Audits"** in sidebar
2. Click **"Schedule Audit"**
3. Fill form:
   - Title: "Quick Test Audit"
   - Scope: "Testing"
   - Department: Select any
   - Base: "Test Base"
   - Date: Tomorrow
   - Select auditors and auditees
4. Click **"Create Audit"**
5. ✅ Verify audit appears in list

#### Test 2: Upload File (30 seconds)
1. Click on the audit you just created
2. Go to **"Documents"** tab
3. Click **"Upload Document"**
4. Upload any file (PDF, image, etc.)
5. ✅ Verify file appears in list

#### Test 3: Create Finding (30 seconds)
1. Go to **"Findings"** page
2. Click **"Add Finding"**
3. Fill form:
   - Select the audit you created
   - Policy: "QMS-001"
   - Description: "Test finding"
   - Severity: "Minor"
   - Assign to: Select user
   - CAP: "Test action"
4. Click **"Create Finding"**
5. ✅ Verify finding appears

#### Test 4: Export (30 seconds)
1. Go back to **"Audits"**
2. Click on your audit
3. Click **"Export PDF Report"**
4. ✅ Verify PDF downloads
5. Go to **"Findings"** page
6. Click **"Export Excel"**
7. ✅ Verify Excel downloads

### Step 4: Verify Everything Works

✅ **Login** - Works  
✅ **Create Audit** - Works  
✅ **Upload File** - Works  
✅ **Create Finding** - Works  
✅ **Export PDF** - Works  
✅ **Export Excel** - Works  

## If Something Doesn't Work

### Can't Login?
```bash
# Re-seed database
npm run db:seed
```

### Files Won't Upload?
```bash
# Create uploads directory
mkdir -p public/uploads/audit
mkdir -p public/uploads/finding
```

### Export Not Working?
- Check browser allows downloads
- Try different browser
- Check console for errors

## Success Criteria

If all 6 checks above are ✅, your system is working correctly!

## Next Steps

For comprehensive testing, see `TESTING_GUIDE.md`
