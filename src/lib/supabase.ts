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

  // Fetch all of today's registration numbers and find the true numeric max
  // (string sort fails at boundaries like 009 > 010 alphabetically)
  const { data } = await supabase
    .from('patients')
    .select('registration_number')
    .like('registration_number', `${datePrefix}-%`)

  let seq = 1
  if (data && data.length > 0) {
    const maxSeq = Math.max(...data.map(p => {
      const parts = p.registration_number.split('-')
      return parseInt(parts[parts.length - 1] || '0')
    }))
    seq = maxSeq + 1
  }

  return `${datePrefix}-${String(seq).padStart(3, '0')}`
}

// Log activity
export async function logActivity(staffId: string, action: string, details: string) {
  await supabase.from('activity_logs').insert({ staff_id: staffId, action, details })
}
