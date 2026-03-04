# File Upload & Export Features Guide

## Overview

The Sky SQ QMS now includes comprehensive file upload capabilities for evidence and attachments, as well as PDF and Excel export functionality.

## File Upload System

### Features

- **Drag & Drop Interface**: Easy-to-use drag and drop file upload
- **Multiple File Types**: Supports images, PDFs, videos, and documents
- **File Size Validation**: Maximum 10MB per file
- **File Type Validation**: Only allowed file types can be uploaded
- **Automatic Storage**: Files are stored in organized directories
- **Database Integration**: File references are saved to the database

### Supported File Types

- **Images**: JPEG, JPG, PNG, GIF
- **Documents**: PDF, DOC, DOCX
- **Videos**: MP4, QuickTime
- **Spreadsheets**: XLS, XLSX

### Upload Locations

1. **Audit Documents** (`/audits/[id]` → Documents tab)
   - Checklists
   - Pre-audit documents
   - Evidence files
   - Photos and videos

2. **Finding Evidence** (`/findings/[id]` → Evidence tab)
   - Photos of non-conformances
   - Supporting documents
   - Video evidence
   - PDF reports

3. **Document Control** (Future enhancement)
   - Controlled documents
   - Version files

### How to Upload Files

1. Navigate to the relevant page (Audit detail or Finding detail)
2. Go to the "Documents" or "Evidence" tab
3. Click "Upload Document" or "Upload Evidence" button
4. Either:
   - Drag and drop files into the upload area, or
   - Click to browse and select files
5. Files will automatically upload and appear in the file list
6. Click "Download" to view/download any uploaded file

### File Storage Structure

```
public/
└── uploads/
    ├── audit/
    │   └── [timestamp]-[random].ext
    ├── finding/
    │   └── [timestamp]-[random].ext
    ├── document/
    │   └── [timestamp]-[random].ext
    └── cap/
        └── [timestamp]-[random].ext
```

## Export Functionality

### PDF Export

#### Audit Reports

**Location**: Audit Detail Page → Quick Actions → "Export PDF Report"

**Includes**:
- Audit details (number, title, department, base)
- Scheduled date and status
- Scope and description
- Audit team (auditors and auditees)
- All findings with details
- Professional formatting
- Page numbers and generation date

**How to Export**:
1. Navigate to an audit detail page
2. Click "Export PDF Report" button
3. PDF will automatically download

### Excel Export

#### Findings Export

**Location**: Findings Page → "Export Excel" button

**Includes**:
- Finding number and audit number
- Department and policy reference
- Description and root cause
- Severity and status
- Assigned person and due date
- Corrective action plan details
- CAP status and due date

**How to Export**:
1. Navigate to Findings page
2. Apply any filters if needed
3. Click "Export Excel" button
4. Excel file will automatically download

#### Dashboard Statistics Export

**Location**: Dashboard → "Export Stats" button

**Includes**:
- Total audits count
- Active audits count
- Open findings count
- Overdue CAPs count
- Pending documents count
- Expiring training count

**How to Export**:
1. Navigate to Dashboard
2. Click "Export Stats" button
3. Excel file will automatically download

## API Endpoints

### File Upload

**POST** `/api/upload`

**Request**:
- `file`: File object (multipart/form-data)
- `entityType`: 'audit' | 'finding' | 'document' | 'cap'
- `entityId`: ID of the entity

**Response**:
```json
{
  "success": true,
  "fileUrl": "/uploads/audit/1234567890-abc123.pdf",
  "fileName": "original-name.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf"
}
```

### Audit Documents

**POST** `/api/audits/[id]/documents`

**Request**:
```json
{
  "name": "Document Name",
  "fileUrl": "/uploads/audit/...",
  "fileType": "application/pdf",
  "fileSize": 1024000
}
```

### Finding Attachments

**POST** `/api/findings/[id]/attachments`

**Request**:
```json
{
  "name": "Evidence Name",
  "fileUrl": "/uploads/finding/...",
  "fileType": "image/jpeg",
  "fileSize": 2048000
}
```

## Components

### FileUpload Component

Reusable file upload component with drag & drop support.

**Props**:
- `entityType`: Type of entity ('audit', 'finding', 'document', 'cap')
- `entityId`: ID of the entity
- `onUploadComplete`: Callback when upload succeeds
- `onUploadError`: Callback when upload fails
- `maxFiles`: Maximum number of files (default: 10)
- `acceptedFileTypes`: Array of accepted MIME types

### FileList Component

Displays list of uploaded files with download and remove options.

**Props**:
- `files`: Array of file objects
- `onRemove`: Callback when file is removed
- `showDownload`: Show download button (default: true)

## Security Features

1. **Authentication Required**: All upload endpoints require authentication
2. **File Size Limits**: 10MB maximum per file
3. **File Type Validation**: Only allowed types can be uploaded
4. **Unique Filenames**: Prevents file overwrites
5. **Activity Logging**: All uploads are logged in activity log

## Best Practices

1. **File Naming**: Use descriptive names for uploaded files
2. **File Size**: Compress large files before uploading
3. **File Types**: Use appropriate file types (PDFs for documents, JPEGs for photos)
4. **Organization**: Upload related files together
5. **Evidence**: Always upload evidence for findings before closing them

## Troubleshooting

### Upload Fails

- Check file size (must be under 10MB)
- Verify file type is allowed
- Check internet connection
- Ensure you're logged in

### Export Not Working

- Ensure you have data to export
- Check browser download settings
- Try a different browser
- Clear browser cache

### Files Not Appearing

- Refresh the page
- Check file was uploaded successfully
- Verify database connection

## Future Enhancements

- [ ] Cloud storage integration (S3, Azure Blob)
- [ ] Image preview in file list
- [ ] File versioning
- [ ] Bulk file upload
- [ ] File compression
- [ ] Custom export templates
- [ ] Scheduled exports
- [ ] Email export functionality
