export type Role = 'admin' | 'staff'
export type Session = 'morning' | 'evening'
export type PaymentType = 'per_session' | 'package' | 'advance'
export type FeesType = 'per_session' | 'package'

export interface Staff {
  id: string
  name: string
  role: Role
  username: string
  is_active: boolean
  created_at: string
}

export interface Patient {
  id: string
  registration_number: string
  name: string
  age: number
  gender: 'Male' | 'Female' | 'Other'
  phone: string
  address: string
  photo_url: string | null
  chief_complaint: string
  fees_type: FeesType
  fees_amount: number
  referred_by: string | null
  previous_sessions: number
  registered_by: string
  registered_by_name?: string
  created_at: string
}

export interface Attendance {
  id: string
  patient_id: string
  patient_name?: string
  registration_number?: string
  date: string
  session: Session
  visit_number: number
  marked_by: string
  marked_by_name?: string
  is_retroactive: boolean
  retroactive_added_by?: string
  retroactive_added_at?: string
  created_at: string
}

export interface Package {
  id: string
  patient_id: string
  total_sessions: number
  amount_paid: number
  start_date: string
  created_by: string
  created_at: string
}

export interface Payment {
  id: string
  patient_id: string
  amount: number
  payment_type: PaymentType
  date: string
  staff_id: string
  staff_name?: string
  notes: string
  created_at: string
}

export interface Expense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  added_by: string
  added_by_name?: string
  created_at: string
}

export interface ActivityLog {
  id: string
  staff_id: string
  staff_name?: string
  action: string
  details: string
  created_at: string
}

export interface RegisteredDevice {
  id: string
  device_token: string
  device_name: string
  registered_by: string
  is_active: boolean
  created_at: string
}

export interface DailyStats {
  date: string
  morning_count: number
  evening_count: number
  total_patients: number
  fees_collected: number
  fees_due: number
  expenses: number
  net_income: number
}
