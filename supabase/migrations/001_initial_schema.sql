-- ============================================
-- Nijanand Fitness Centre — Database Schema
-- ============================================

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registered devices (device locking)
CREATE TABLE registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  registered_by UUID REFERENCES staff(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  photo_url TEXT,
  chief_complaint TEXT NOT NULL,
  fees_type TEXT NOT NULL CHECK (fees_type IN ('per_session', 'package')),
  fees_amount NUMERIC(10,2) NOT NULL DEFAULT 350,
  registered_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  visit_number INTEGER NOT NULL,
  marked_by UUID REFERENCES staff(id),
  is_retroactive BOOLEAN DEFAULT false,
  retroactive_added_by UUID REFERENCES staff(id),
  retroactive_added_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, date, session)
);

-- Packages table
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  total_sessions INTEGER NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  start_date DATE NOT NULL,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('per_session', 'package', 'advance')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  staff_id UUID REFERENCES staff(id),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  added_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Seed: Initial Staff Accounts
-- Passwords are bcrypt hashed
-- Default password for all: NFC@2026
-- ============================================
-- NOTE: Run password hashing via app, these are placeholders
INSERT INTO staff (name, role, username, password_hash) VALUES
  ('Dr. Piyush Koladiya', 'admin', 'piyush', 'PLACEHOLDER'),
  ('Dr. Aruna Koladiya', 'staff', 'aruna', 'PLACEHOLDER'),
  ('Dr. Divyaxi', 'staff', 'divyaxi', 'PLACEHOLDER'),
  ('Dr. Shreya', 'staff', 'shreya', 'PLACEHOLDER'),
  ('Clinic Mobile', 'staff', 'clinic', 'PLACEHOLDER');

-- ============================================
-- Views for common queries
-- ============================================

-- Patient attendance summary
CREATE VIEW patient_attendance_summary AS
SELECT
  p.id,
  p.registration_number,
  p.name,
  COUNT(a.id) AS total_visits,
  MIN(a.date) AS first_visit,
  MAX(a.date) AS last_visit
FROM patients p
LEFT JOIN attendance a ON a.patient_id = p.id
GROUP BY p.id, p.registration_number, p.name;

-- Daily OPD summary
CREATE VIEW daily_opd_summary AS
SELECT
  a.date,
  a.session,
  COUNT(a.id) AS patient_count
FROM attendance a
GROUP BY a.date, a.session
ORDER BY a.date DESC, a.session;
