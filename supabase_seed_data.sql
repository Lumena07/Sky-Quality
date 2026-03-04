-- ============================================
-- Supabase Seed Data Script
-- ============================================
-- This script seeds the database with departments and users
-- Run this in Supabase SQL Editor after creating the schema
-- 
-- Note: Passwords are hashed using bcrypt. Default password is "password123"
-- You can generate new hashes at: https://bcrypt-generator.com/

-- ============================================
-- 1. Create Departments
-- ============================================
INSERT INTO "Department" (id, name, code, description, "isActive", "createdAt", "updatedAt")
VALUES 
  ('dept_ops_001', 'Operations', 'OPS', 'Flight Operations Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_maint_001', 'Maintenance', 'MAINT', 'Aircraft Maintenance Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_quality_001', 'Quality', 'QUALITY', 'Quality Assurance Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_ground_001', 'Ground Operations', 'GROUND', 'Ground Operations Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_safety_001', 'Safety', 'SAFETY', 'Safety Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('dept_training_001', 'Training', 'TRAINING', 'Training Department', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Create Users (Auditors, Managers, Staff)
-- ============================================
-- Password hash for "password123" using bcrypt (cost 10)
-- Default password for all users: password123
-- Hash: $2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi

INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "departmentId", position, "isActive", "createdAt", "updatedAt")
VALUES 
  -- System Admin
  ('user_admin_001', 'admin@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'System', 'Admin', 'SYSTEM_ADMIN', 'dept_quality_001', 'System Administrator', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Quality Managers
  ('user_qm_001', 'quality.manager@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'John', 'Smith', 'QUALITY_MANAGER', 'dept_quality_001', 'Quality Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_qm_002', 'quality.manager2@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Mary', 'Johnson', 'QUALITY_MANAGER', 'dept_quality_001', 'Deputy Quality Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Auditors
  ('user_auditor_001', 'auditor1@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Jane', 'Doe', 'AUDITOR', 'dept_quality_001', 'Senior Auditor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_auditor_002', 'auditor2@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Robert', 'Brown', 'AUDITOR', 'dept_quality_001', 'Auditor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_auditor_003', 'auditor3@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Emily', 'Davis', 'AUDITOR', 'dept_quality_001', 'Junior Auditor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_auditor_004', 'auditor4@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Michael', 'Wilson', 'AUDITOR', 'dept_quality_001', 'Auditor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Department Heads
  ('user_dept_ops_001', 'ops.head@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Mike', 'Johnson', 'DEPARTMENT_HEAD', 'dept_ops_001', 'Operations Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_dept_maint_001', 'maint.head@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'David', 'Martinez', 'DEPARTMENT_HEAD', 'dept_maint_001', 'Maintenance Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_dept_ground_001', 'ground.head@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Lisa', 'Anderson', 'DEPARTMENT_HEAD', 'dept_ground_001', 'Ground Operations Manager', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  
  -- Staff (Potential Auditees)
  ('user_staff_001', 'staff1@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Sarah', 'Williams', 'STAFF', 'dept_ops_001', 'Operations Officer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_staff_002', 'staff2@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'James', 'Taylor', 'STAFF', 'dept_ops_001', 'Flight Dispatcher', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_staff_003', 'staff3@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Patricia', 'Moore', 'STAFF', 'dept_maint_001', 'Aircraft Mechanic', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_staff_004', 'staff4@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Richard', 'Jackson', 'STAFF', 'dept_maint_001', 'Avionics Technician', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_staff_005', 'staff5@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'Jennifer', 'White', 'STAFF', 'dept_ground_001', 'Ground Operations Officer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('user_staff_006', 'staff6@skysq.com', '$2a$10$jZdVl1x1PU8JAV//yBLHeO1eO.FHbV2J3iLZel0cIsM4QeOE7Pmwi', 'William', 'Harris', 'STAFF', 'dept_ground_001', 'Ramp Agent', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Notes:
-- ============================================
-- 1. All passwords are set to "password123" (bcrypt hash)
-- 2. To change passwords, generate new bcrypt hashes at: https://bcrypt-generator.com/
-- 3. Replace the password hash in the INSERT statements above
-- 4. Default login: admin@skysq.com / password123
-- 5. You can add more users by following the same pattern
-- 6. For external auditees not in the system, use the AuditAuditee table with name/email fields (userId will be null)

-- ============================================
-- To add more users manually:
-- ============================================
-- INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "departmentId", position, "isActive", "createdAt", "updatedAt")
-- VALUES (
--   'user_unique_id', 
--   'email@example.com', 
--   '$2a$10$YOUR_BCRYPT_HASH_HERE',  -- Generate at https://bcrypt-generator.com/
--   'First', 
--   'Last', 
--   'AUDITOR',  -- or 'QUALITY_MANAGER', 'DEPARTMENT_HEAD', 'STAFF', 'SYSTEM_ADMIN'
--   'dept_quality_001',  -- Department ID
--   'Position Title',
--   true,
--   CURRENT_TIMESTAMP,
--   CURRENT_TIMESTAMP
-- )
-- ON CONFLICT (email) DO NOTHING;
