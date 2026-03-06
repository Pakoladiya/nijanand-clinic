import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Generate registration number: NFC-DDMMYY-NNN
export async function generateRegistrationNumber(): Promise<string> {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const datePrefix = `NFC-${dd}${mm}${yy}`

  // Count patients registered today
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const { count } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay)

  const seq = String((count || 0) + 1).padStart(3, '0')
  return `${datePrefix}-${seq}`
}

// Log activity
export async function logActivity(staffId: string, action: string, details: string) {
  await supabase.from('activity_logs').insert({ staff_id: staffId, action, details })
}
