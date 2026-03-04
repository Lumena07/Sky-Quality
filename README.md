# Sky SQ - Quality Management System

A comprehensive web-based Internal Company Quality Management System (QMS) for an aviation company's Quality Department.

## Features

### 🔹 1. Audit Management Module
- Clickable calendar-based audit scheduling
- Full audit workspace with:
  - Audit scope and department assignment
  - Base/location tracking
  - Auditor and auditee assignment
  - Internal checklist upload and sharing
  - Automatic internal notifications
  - Pre-audit document requests
  - On-site/remote audit recording forms
  - Evidence uploads (photos, PDFs, videos)
  - Finding entry forms
  - Audit report generator
- Status flow: Planned → Active → Completed → Closed
- Complete workflow: Schedule → Notify → Send Checklist → Conduct Audit → Record Findings → Report → Close

### 🔹 2. Findings & Corrective Action Tracker
- Centralized system for managing audit findings
- Each finding includes:
  - Auto-generated finding ID
  - Internal policy/manual reference
  - Description of non-conformance
  - Root cause analysis
  - Corrective Action Plan (CAP)
  - Responsible person assignment
  - Due date tracking
  - Progress status
  - Evidence attachments
  - Management approval
- Automated reminders and overdue alerts
- Change history tracking
- Evidence validation before closure
- Escalation to management

### 🔹 3. Document Control System
- Internal document management with:
  - Version control
  - Draft/Review/Approve/Release workflow
  - Revision history
  - Controlled access
  - Staff acknowledgment tracking
  - Obsolete document archiving
- Only approved documents may be used

### 🔹 4. Training & Competency Tracking
- Staff competency module with:
  - Employee profiles
  - Internal training and qualifications records
  - Certificate expiry tracking
  - Training gaps linked to audit findings
  - Training plan generation
  - Expiry reminders

### 🔹 5. Management Dashboard
- Real-time dashboard showing:
  - Audit completion rate
  - Open vs closed findings
  - Overdue corrective actions
  - Department compliance status
  - Training coverage
  - Recurring problem trends
- Filters: department, base, date range

### 🔹 6. User Roles & Access Control
- Role-based permissions:
  - System Admin
  - Quality Manager
  - Auditor
  - Department Head
  - Staff
- Restricted access by role

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (Prisma ORM) - easily switchable to PostgreSQL
- **Authentication**: NextAuth.js
- **Styling**: TailwindCSS
- **UI Components**: Radix UI + shadcn/ui
- **Form Handling**: React Hook Form + Zod
- **Date Handling**: date-fns

## Installation Guide

### Prerequisites
- Node.js 18+ and npm/yarn
- Git

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sky-sq
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

After seeding the database, you can login with:

- **Email**: `admin@skysq.com`
- **Password**: `password123`

Other test users:
- `quality.manager@skysq.com` (Quality Manager)
- `auditor1@skysq.com` (Auditor)
- `ops.head@skysq.com` (Department Head)
- `staff1@skysq.com` (Staff)

## Testing the System

### Quick 5-Minute Test
See **[QUICK_START_TEST.md](./QUICK_START_TEST.md)** for a fast testing guide that covers:
- Basic setup verification
- Creating an audit
- Uploading files
- Creating findings
- Testing exports

### Comprehensive Testing Guide
See **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** for complete testing instructions covering:
- All modules and features
- File upload functionality
- PDF and Excel export functionality
- Role-based access testing
- Error handling
- Performance testing
- Browser compatibility
- Mobile responsiveness

## Project Structure

```
sky-sq/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── audits/            # Audit management pages
│   ├── findings/          # Findings & CAP pages
│   ├── documents/         # Document control pages
│   ├── training/          # Training module pages
│   ├── dashboard/         # Dashboard page
│   └── login/             # Login page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Layout components
│   ├── audits/           # Audit-specific components
│   └── findings/         # Finding-specific components
├── lib/                   # Utility functions
│   ├── auth.ts           # Authentication config
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Helper functions
├── prisma/                # Database schema and migrations
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
└── types/                 # TypeScript type definitions
```

## Database Schema

The system uses a comprehensive relational database schema with the following main entities:

- **Users**: User accounts with role-based access
- **Departments**: Organizational departments
- **Audits**: Audit records with scheduling
- **Findings**: Audit findings
- **CorrectiveActions**: Corrective action plans
- **Documents**: Controlled documents with versioning
- **TrainingRecords**: Employee training and competency records
- **Notifications**: System notifications
- **ActivityLogs**: Audit trail for all actions

## API Routes

- `/api/auth/[...nextauth]` - Authentication
- `/api/audits` - Audit management
- `/api/findings` - Findings management
- `/api/documents` - Document control
- `/api/training` - Training records
- `/api/dashboard/stats` - Dashboard statistics
- `/api/departments` - Department management
- `/api/users` - User management

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## Production Deployment

1. Update `.env` with production values
2. Change database from SQLite to PostgreSQL (update `DATABASE_URL`)
3. Run migrations: `npx prisma migrate deploy`
4. Build: `npm run build`
5. Start: `npm run start`

## Security Considerations

- All passwords are hashed using bcrypt
- Role-based access control enforced at API and UI levels
- Session-based authentication with NextAuth.js
- Activity logging for audit trail
- Input validation with Zod schemas

## License

Proprietary - Internal Use Only
