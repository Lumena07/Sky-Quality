# System Architecture - Sky SQ Quality Management System

## Overview

Sky SQ is a comprehensive Quality Management System built with modern web technologies. The system follows a full-stack architecture with a Next.js frontend and backend API, using Prisma ORM for database management.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: Radix UI + shadcn/ui
- **Form Management**: React Hook Form + Zod
- **Date Handling**: date-fns
- **Icons**: Lucide React

### Backend
- **Framework**: Next.js API Routes
- **ORM**: Prisma
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: NextAuth.js
- **Password Hashing**: bcryptjs

### Development Tools
- **TypeScript**: Type safety and better developer experience
- **ESLint**: Code linting
- **Prisma Studio**: Database management UI

## Architecture Patterns

### 1. Server-Side Rendering (SSR) & API Routes

The application uses Next.js App Router with:
- Server Components for initial page loads
- Client Components for interactive features
- API Routes for backend logic

### 2. Database Layer

**Prisma ORM** provides:
- Type-safe database access
- Automatic migrations
- Database schema management
- Query optimization

**Database Schema Structure:**
```
Users
├── Departments
├── Audits
│   ├── AuditAuditors
│   ├── AuditAuditees
│   ├── AuditDocuments
│   └── Findings
│       ├── FindingAttachments
│       └── CorrectiveActions
│           └── CAPAttachments
├── Documents
│   ├── DocumentRevisions
│   └── DocumentAcknowledgment
├── TrainingRecords
├── Notifications
└── ActivityLogs
```

### 3. Authentication & Authorization

**NextAuth.js** handles:
- Session management
- JWT tokens
- Role-based access control (RBAC)

**User Roles:**
- SYSTEM_ADMIN: Full system access
- QUALITY_MANAGER: Quality department management
- AUDITOR: Audit creation and management
- DEPARTMENT_HEAD: Department oversight
- STAFF: Basic access

### 4. State Management

- **Server State**: Fetched via API routes
- **Client State**: React hooks (useState, useEffect)
- **Form State**: React Hook Form

## Project Structure

```
sky-sq/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes
│   │   ├── auth/                # Authentication endpoints
│   │   ├── audits/              # Audit management APIs
│   │   ├── findings/            # Findings APIs
│   │   ├── documents/           # Document control APIs
│   │   ├── training/            # Training APIs
│   │   ├── dashboard/           # Dashboard APIs
│   │   ├── departments/        # Department APIs
│   │   └── users/               # User APIs
│   ├── audits/                  # Audit pages
│   │   ├── page.tsx            # Audit list
│   │   └── [id]/               # Audit detail
│   ├── findings/                # Findings pages
│   ├── documents/               # Document pages
│   ├── training/                # Training pages
│   ├── dashboard/               # Dashboard page
│   ├── admin/                   # Admin pages
│   ├── login/                   # Login page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (redirects)
│   └── globals.css             # Global styles
├── components/                   # React components
│   ├── ui/                     # Reusable UI components
│   ├── layout/                 # Layout components
│   ├── audits/                 # Audit-specific components
│   └── findings/               # Finding-specific components
├── lib/                         # Utility libraries
│   ├── auth.ts                 # Auth configuration
│   ├── prisma.ts               # Prisma client
│   └── utils.ts                # Helper functions
├── prisma/                      # Database
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Seed data
├── types/                       # TypeScript types
│   └── next-auth.d.ts          # NextAuth type extensions
├── middleware.ts                # Next.js middleware
└── public/                      # Static assets
```

## Data Flow

### 1. User Authentication Flow

```
User → Login Page → NextAuth → Database → JWT Token → Session → Protected Routes
```

### 2. Audit Creation Flow

```
User → Create Audit Form → API Route → Prisma → Database
                                    ↓
                            Create Notifications
                                    ↓
                            Log Activity
```

### 3. Finding & CAP Flow

```
Audit → Finding Created → Assigned to User → Notification Sent
                                    ↓
                            CAP Created → Status Tracking
                                    ↓
                            Evidence Upload → Management Approval → Closure
```

### 4. Document Control Flow

```
Document Upload → Draft → Review → Approval → Release
                                    ↓
                            Version Control
                                    ↓
                            Staff Acknowledgment
```

## Security Features

### 1. Authentication
- Password hashing with bcrypt
- JWT-based sessions
- Secure cookie handling

### 2. Authorization
- Role-based access control
- Route protection via middleware
- API endpoint authorization checks

### 3. Data Validation
- Zod schema validation
- Input sanitization
- Type safety with TypeScript

### 4. Audit Trail
- Activity logging for all actions
- User tracking
- Timestamp recording

## API Design

### RESTful Conventions

- `GET /api/resource` - List resources
- `GET /api/resource/[id]` - Get single resource
- `POST /api/resource` - Create resource
- `PATCH /api/resource/[id]` - Update resource
- `DELETE /api/resource/[id]` - Delete resource

### Response Format

```typescript
// Success
{
  data: {...}
}

// Error
{
  error: "Error message"
}
```

## Database Design Principles

### 1. Normalization
- Third normal form (3NF)
- Proper foreign key relationships
- Indexed fields for performance

### 2. Relationships
- One-to-Many: User → Audits, Department → Users
- Many-to-Many: Audit ↔ Users (via junction tables)
- One-to-One: Finding → CorrectiveAction

### 3. Indexing
- Primary keys on all tables
- Foreign key indexes
- Status and date indexes for filtering

## Performance Considerations

### 1. Database Queries
- Eager loading with Prisma `include`
- Selective field queries
- Pagination for large datasets

### 2. Frontend Optimization
- Server-side rendering
- Client-side caching
- Lazy loading components

### 3. File Handling
- File size limits
- Secure file storage
- Efficient file serving

## Scalability

### Current Architecture
- Single server deployment
- SQLite for small teams
- File-based storage

### Production Scalability
- PostgreSQL for larger datasets
- Cloud storage (S3, etc.)
- Load balancing
- CDN for static assets
- Database replication

## Future Enhancements

1. **Real-time Updates**: WebSocket integration
2. **Email Notifications**: SMTP integration
3. **File Storage**: Cloud storage integration
4. **Reporting**: Advanced analytics
5. **Mobile App**: React Native version
6. **API Documentation**: OpenAPI/Swagger
7. **Caching**: Redis integration
8. **Search**: Full-text search capabilities

## Deployment Architecture

### Development
```
Local Machine
├── Next.js Dev Server (Port 3000)
├── SQLite Database (File-based)
└── File Storage (Local filesystem)
```

### Production
```
Load Balancer
├── Next.js Server 1
├── Next.js Server 2
└── Next.js Server N
        ↓
    PostgreSQL Database
        ↓
    Cloud Storage (S3, etc.)
```

## Monitoring & Logging

### Current Implementation
- Console logging
- Activity logs in database
- Error handling in API routes

### Recommended Production
- Application monitoring (Sentry, etc.)
- Database query monitoring
- Performance metrics
- User activity analytics
