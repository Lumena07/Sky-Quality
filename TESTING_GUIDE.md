# Testing Guide - Sky SQ Quality Management System

## Prerequisites

Before testing, ensure you have:
- Node.js 18+ installed
- npm or yarn package manager
- Git (if cloning from repository)

## Step 1: Initial Setup

### 1.1 Install Dependencies

```bash
npm install
```

### 1.2 Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and set:
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="test-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### 1.3 Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Create database and apply schema
npm run db:push

# Seed database with sample data
npm run db:seed
```

### 1.4 Start Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## Step 2: Login Testing

### 2.1 Test Default Login Credentials

Navigate to `http://localhost:3000/login` and test with:

**System Admin:**
- Email: `admin@skysq.com`
- Password: `password123`

**Quality Manager:**
- Email: `quality.manager@skysq.com`
- Password: `password123`

**Auditor:**
- Email: `auditor1@skysq.com`
- Password: `password123`

**Department Head:**
- Email: `ops.head@skysq.com`
- Password: `password123`

**Staff:**
- Email: `staff1@skysq.com`
- Password: `password123`

### 2.2 Verify Login Features

- ✅ Login with valid credentials
- ✅ Reject invalid credentials
- ✅ Redirect to dashboard after login
- ✅ Session persistence (refresh page)
- ✅ Logout functionality

## Step 3: Dashboard Testing

### 3.1 Test Dashboard Display

1. Login as admin
2. Verify dashboard loads
3. Check statistics cards display:
   - Total Audits
   - Active Audits
   - Open Findings
   - Overdue CAPs
   - Pending Documents
   - Expiring Training

### 3.2 Test Dashboard Export

1. Click "Export Stats" button
2. Verify Excel file downloads
3. Open file and verify data is correct

### 3.3 Test Navigation

- Click on each stat card → Should navigate to filtered view
- Test sidebar navigation
- Verify all menu items work

## Step 4: Audit Management Testing

### 4.1 Create a New Audit

1. Navigate to **Audits** page
2. Click **"Schedule Audit"** button
3. Fill in the form:
   - Title: "Test Audit - Q1 2024"
   - Description: "Testing audit creation"
   - Scope: "Operations Department - Flight Operations"
   - Department: Select "Operations"
   - Base: "Main Base"
   - Scheduled Date: Select a future date
   - Auditors: Select at least one auditor
   - Auditees: Select at least one auditee
4. Click **"Create Audit"**
5. Verify audit appears in the list

### 4.2 Test Audit Calendar

1. On Audits page, check the calendar
2. Click on a date with an audit
3. Verify audit details appear
4. Click on audit → Should navigate to detail page

### 4.3 Test Audit Detail Page

1. Click on any audit from the list
2. Verify all tabs work:
   - **Overview**: Shows audit details
   - **Findings**: Shows related findings
   - **Documents**: Shows uploaded documents
   - **Team**: Shows auditors and auditees

### 4.4 Test Audit File Upload

1. Go to Audit detail page
2. Click **"Documents"** tab
3. Click **"Upload Document"** button
4. Test drag & drop:
   - Drag a file into the upload area
   - Verify file uploads
5. Test click to browse:
   - Click upload area
   - Select a file
   - Verify file uploads
6. Verify file appears in the list
7. Click **"Download"** → Verify file downloads

**Test Files:**
- Upload a PDF (checklist)
- Upload an image (photo evidence)
- Upload a video (if available)

### 4.5 Test Audit PDF Export

1. On Audit detail page
2. Click **"Export PDF Report"** button
3. Verify PDF downloads
4. Open PDF and verify:
   - Audit number and title
   - Department and base
   - Scheduled date
   - Scope
   - Team members
   - Findings (if any)

### 4.6 Test Audit Status Changes

1. Create an audit (status: PLANNED)
2. Click **"Start Audit"** → Status should change to ACTIVE
3. Click **"Complete Audit"** → Status should change to COMPLETED

## Step 5: Findings & CAP Testing

### 5.1 Create a Finding

1. Navigate to **Findings** page
2. Click **"Add Finding"** button
3. Fill in the form:
   - Audit: Select an audit
   - Department: Select department
   - Policy Reference: "QMS-001 Section 4.2"
   - Description: "Test finding description"
   - Root Cause: "Test root cause analysis"
   - Severity: Select "Major"
   - Assigned To: Select a user
   - Due Date: Select a future date
   - Corrective Action Plan: "Test corrective action"
4. Click **"Create Finding"**
5. Verify finding appears in the list

### 5.2 Test Finding Filters

1. On Findings page
2. Test filter buttons:
   - **All**: Shows all findings
   - **Open**: Shows only open findings
   - **In Progress**: Shows in-progress findings
   - **Closed**: Shows closed findings

### 5.3 Test Finding Detail Page

1. Click on a finding from the list
2. Verify all tabs:
   - **Details**: Finding information
   - **Corrective Action**: CAP details
   - **Evidence**: Uploaded evidence

### 5.4 Test Finding Evidence Upload

1. Go to Finding detail page
2. Click **"Evidence"** tab
3. Click **"Upload Evidence"** button
4. Upload a file (photo, PDF, etc.)
5. Verify file appears in evidence list
6. Test download functionality

### 5.5 Test Findings Excel Export

1. On Findings page
2. Apply filters if needed
3. Click **"Export Excel"** button
4. Verify Excel file downloads
5. Open file and verify:
   - All findings are included
   - Columns are properly formatted
   - Data is correct

### 5.6 Test Finding Status Flow

1. Create a finding (status: OPEN)
2. Verify it appears in "Open" filter
3. Update status to IN_PROGRESS
4. Verify it appears in "In Progress" filter
5. Update status to CLOSED
6. Verify it appears in "Closed" filter

## Step 6: Document Control Testing

### 6.1 View Documents

1. Navigate to **Documents** page
2. Verify document list displays
3. Test status filters:
   - Draft
   - Review
   - Approved
   - Released

### 6.2 Test Document Workflow

1. Create a document (if upload functionality is implemented)
2. Verify it appears with status "Draft"
3. Change status to "Review"
4. Change status to "Approved"
5. Change status to "Released"

## Step 7: Training Module Testing

### 7.1 View Training Records

1. Navigate to **Training** page
2. Verify training records display
3. Check for:
   - Employee names
   - Training titles
   - Issue dates
   - Expiry dates
   - Status indicators

### 7.2 Test Expiring Training

1. Check for training records with expiry dates
2. Verify "Expiring Soon" badges appear
3. Verify "Expired" badges appear for past dates

## Step 8: File Upload Testing

### 8.1 Test File Size Validation

1. Try uploading a file larger than 10MB
2. Verify error message appears
3. Verify file is rejected

### 8.2 Test File Type Validation

1. Try uploading an unsupported file type (e.g., .exe)
2. Verify error message appears
3. Verify file is rejected

### 8.3 Test Multiple File Upload

1. Upload multiple files at once
2. Verify all files upload successfully
3. Verify all files appear in the list

### 8.4 Test File Download

1. Upload a file
2. Click "Download" button
3. Verify file downloads correctly
4. Verify file opens correctly

## Step 9: Role-Based Access Testing

### 9.1 Test System Admin Access

1. Login as admin (`admin@skysq.com`)
2. Verify access to:
   - ✅ All modules
   - ✅ Admin panel
   - ✅ All features

### 9.2 Test Quality Manager Access

1. Login as quality manager
2. Verify access to:
   - ✅ Audits
   - ✅ Findings
   - ✅ Documents
   - ✅ Training
   - ✅ Dashboard

### 9.3 Test Auditor Access

1. Login as auditor
2. Verify access to:
   - ✅ Audits (create and view)
   - ✅ Findings (create and view)
   - ✅ Dashboard

### 9.4 Test Department Head Access

1. Login as department head
2. Verify access to:
   - ✅ View audits for their department
   - ✅ View findings for their department
   - ✅ Dashboard

### 9.5 Test Staff Access

1. Login as staff
2. Verify limited access
3. Verify can view assigned items

## Step 10: Integration Testing

### 10.1 Test Complete Audit Workflow

1. **Create Audit**
   - Schedule new audit
   - Assign auditors and auditees
   - Verify notifications sent

2. **Upload Documents**
   - Upload checklist
   - Upload pre-audit documents
   - Verify files saved

3. **Start Audit**
   - Change status to ACTIVE
   - Verify status updates

4. **Create Findings**
   - Add findings during audit
   - Assign to users
   - Verify notifications sent

5. **Upload Evidence**
   - Upload evidence for findings
   - Verify files attached

6. **Complete Audit**
   - Change status to COMPLETED
   - Generate PDF report
   - Verify report includes all data

### 10.2 Test Finding to CAP Workflow

1. Create a finding
2. Verify CAP is automatically created
3. Verify CAP is assigned to responsible person
4. Upload evidence for CAP
5. Update CAP status
6. Verify management approval (if applicable)
7. Close finding
8. Verify finding status updates

## Step 11: Error Handling Testing

### 11.1 Test Network Errors

1. Disconnect internet
2. Try to create an audit
3. Verify error message appears
4. Reconnect internet
5. Verify system recovers

### 11.2 Test Validation Errors

1. Try to create audit without required fields
2. Verify validation errors appear
3. Verify form doesn't submit

### 11.3 Test Unauthorized Access

1. Try to access API directly without login
2. Verify 401 Unauthorized response
3. Verify redirect to login page

## Step 12: Performance Testing

### 12.1 Test Page Load Times

1. Measure dashboard load time
2. Measure audits page load time
3. Measure findings page load time
4. All should load within 2-3 seconds

### 12.2 Test Large Data Sets

1. Create multiple audits (10+)
2. Verify calendar handles them correctly
3. Verify list pagination works (if implemented)

## Step 13: Browser Compatibility Testing

Test in multiple browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (if on Mac)

Verify:
- All features work
- UI displays correctly
- File uploads work
- Exports work

## Step 14: Mobile Responsiveness Testing

1. Open application on mobile device or resize browser
2. Verify:
   - Sidebar collapses
   - Forms are usable
   - Tables are scrollable
   - Buttons are accessible
   - File upload works

## Common Issues & Troubleshooting

### Issue: Database not found

**Solution:**
```bash
npm run db:push
npm run db:seed
```

### Issue: Login not working

**Solution:**
1. Check database is seeded: `npm run db:seed`
2. Check `.env` file has correct `NEXTAUTH_SECRET`
3. Clear browser cookies
4. Restart dev server

### Issue: File upload fails

**Solution:**
1. Check `public/uploads` directory exists
2. Check file size (must be < 10MB)
3. Check file type is allowed
4. Check browser console for errors

### Issue: Export not working

**Solution:**
1. Check browser allows downloads
2. Check browser console for errors
3. Try different browser
4. Verify data exists to export

### Issue: Page not loading

**Solution:**
1. Check dev server is running
2. Check for console errors
3. Clear browser cache
4. Restart dev server: `npm run dev`

## Testing Checklist

### Core Functionality
- [ ] Login/Logout works
- [ ] Dashboard displays correctly
- [ ] Navigation works
- [ ] All pages load

### Audit Module
- [ ] Create audit
- [ ] View audit list
- [ ] View audit detail
- [ ] Upload audit documents
- [ ] Export audit PDF
- [ ] Update audit status
- [ ] Calendar displays audits

### Findings Module
- [ ] Create finding
- [ ] View findings list
- [ ] Filter findings
- [ ] View finding detail
- [ ] Upload evidence
- [ ] Export findings Excel
- [ ] Update finding status

### File Upload
- [ ] Upload images
- [ ] Upload PDFs
- [ ] Upload videos
- [ ] Download files
- [ ] File size validation
- [ ] File type validation

### Export Functionality
- [ ] Export audit PDF
- [ ] Export findings Excel
- [ ] Export dashboard stats Excel

### Security
- [ ] Authentication required
- [ ] Role-based access works
- [ ] Unauthorized access blocked

## Quick Test Script

Run this quick test sequence:

```bash
# 1. Setup
npm install
npm run db:push
npm run db:seed
npm run dev

# 2. Open browser: http://localhost:3000
# 3. Login: admin@skysq.com / password123
# 4. Create an audit
# 5. Upload a document to the audit
# 6. Create a finding for the audit
# 7. Upload evidence to the finding
# 8. Export audit PDF
# 9. Export findings Excel
# 10. Logout and login as different user
```

## Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Document issues** in issue tracker
3. **Update test cases** based on findings
4. **Performance optimization** if needed
5. **Security review** before production

## Need Help?

If you encounter issues:
1. Check browser console for errors
2. Check terminal for server errors
3. Review logs in database
4. Check `FILE_UPLOAD_EXPORT_GUIDE.md` for file features
5. Check `INSTALLATION.md` for setup issues
