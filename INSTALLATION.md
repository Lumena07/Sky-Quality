# Installation Guide - Sky SQ Quality Management System

## Prerequisites

Before installing the system, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** or **yarn** package manager
- **Git** (for cloning the repository)

## Step-by-Step Installation

### 1. Clone or Extract the Project

If you have the project in a repository:
```bash
git clone <repository-url>
cd sky-sq
```

Or if you have the project files, navigate to the project directory:
```bash
cd sky-sq
```

### 2. Install Dependencies

Install all required npm packages:
```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- Next.js framework
- Prisma ORM
- React and React DOM
- UI component libraries
- Authentication libraries
- And other required packages

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit the `.env` file and configure the following variables:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

**Important Notes:**
- For production, generate a secure random string for `NEXTAUTH_SECRET`. You can use:
  ```bash
  openssl rand -base64 32
  ```
- For production, update `NEXTAUTH_URL` to your actual domain (e.g., `https://qms.yourcompany.com`)
- For production with PostgreSQL, change `DATABASE_URL` to:
  ```
  DATABASE_URL="postgresql://user:password@localhost:5432/skysq_db"
  ```

### 4. Set Up the Database

Generate the Prisma client:
```bash
npm run db:generate
```

Create the database and apply the schema:
```bash
npm run db:push
```

### 5. Seed the Database

Populate the database with initial data (departments, users, etc.):
```bash
npm run db:seed
```

This will create:
- Sample departments (Operations, Maintenance, Quality)
- Sample users with different roles
- Default login credentials (see below)

### 6. Start the Development Server

Run the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Default Login Credentials

After seeding the database, you can login with these credentials:

### System Administrator
- **Email**: `admin@skysq.com`
- **Password**: `password123`
- **Role**: System Admin (full access)

### Quality Manager
- **Email**: `quality.manager@skysq.com`
- **Password**: `password123`
- **Role**: Quality Manager

### Auditor
- **Email**: `auditor1@skysq.com`
- **Password**: `password123`
- **Role**: Auditor

### Department Head
- **Email**: `ops.head@skysq.com`
- **Password**: `password123`
- **Role**: Department Head

### Staff
- **Email**: `staff1@skysq.com`
- **Password**: `password123`
- **Role**: Staff

**⚠️ IMPORTANT**: Change all default passwords immediately after first login in a production environment!

## Production Deployment

### 1. Switch to PostgreSQL (Recommended)

For production, it's recommended to use PostgreSQL instead of SQLite:

1. Set up a PostgreSQL database
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/database_name"
   ```
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Build the Application

```bash
npm run build
```

### 3. Start the Production Server

```bash
npm start
```

### 4. Environment Variables for Production

Ensure all production environment variables are set:
- `DATABASE_URL` - Production database connection string
- `NEXTAUTH_SECRET` - Strong random secret
- `NEXTAUTH_URL` - Production domain URL

## Troubleshooting

### Database Issues

If you encounter database errors:

1. **Reset the database** (⚠️ This will delete all data):
   ```bash
   rm prisma/dev.db
   npm run db:push
   npm run db:seed
   ```

2. **View database in Prisma Studio**:
   ```bash
   npm run db:studio
   ```

### Port Already in Use

If port 3000 is already in use:
```bash
# Use a different port
PORT=3001 npm run dev
```

### Module Not Found Errors

If you get module not found errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Authentication Issues

If login doesn't work:
1. Check that the database was seeded properly
2. Verify `NEXTAUTH_SECRET` is set in `.env`
3. Check browser console for errors

## Additional Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **NextAuth.js Documentation**: https://next-auth.js.org

## Support

For issues or questions, please contact your system administrator or refer to the main README.md file.
