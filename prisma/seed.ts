import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create departments
  const dept1 = await prisma.department.upsert({
    where: { code: 'OPS' },
    update: {},
    create: {
      name: 'Operations',
      code: 'OPS',
      description: 'Flight Operations Department',
    },
  })

  const dept2 = await prisma.department.upsert({
    where: { code: 'MAINT' },
    update: {},
    create: {
      name: 'Maintenance',
      code: 'MAINT',
      description: 'Aircraft Maintenance Department',
    },
  })

  const dept3 = await prisma.department.upsert({
    where: { code: 'QUALITY' },
    update: {},
    create: {
      name: 'Quality',
      code: 'QUALITY',
      description: 'Quality Assurance Department',
    },
  })

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@skysq.com' },
    update: {},
    create: {
      email: 'admin@skysq.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SYSTEM_ADMIN',
      departmentId: dept3.id,
      position: 'System Administrator',
    },
  })

  const qualityManager = await prisma.user.upsert({
    where: { email: 'quality.manager@skysq.com' },
    update: {},
    create: {
      email: 'quality.manager@skysq.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Smith',
      role: 'QUALITY_MANAGER',
      departmentId: dept3.id,
      position: 'Quality Manager',
    },
  })

  const auditor1 = await prisma.user.upsert({
    where: { email: 'auditor1@skysq.com' },
    update: {},
    create: {
      email: 'auditor1@skysq.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'AUDITOR',
      departmentId: dept3.id,
      position: 'Senior Auditor',
    },
  })

  const deptHead1 = await prisma.user.upsert({
    where: { email: 'ops.head@skysq.com' },
    update: {},
    create: {
      email: 'ops.head@skysq.com',
      password: hashedPassword,
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'DEPARTMENT_HEAD',
      departmentId: dept1.id,
      position: 'Operations Manager',
    },
  })

  const staff1 = await prisma.user.upsert({
    where: { email: 'staff1@skysq.com' },
    update: {},
    create: {
      email: 'staff1@skysq.com',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Williams',
      role: 'STAFF',
      departmentId: dept1.id,
      position: 'Operations Officer',
    },
  })

  console.log('Seed data created successfully!')
  console.log('Default login credentials:')
  console.log('Email: admin@skysq.com')
  console.log('Password: password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
