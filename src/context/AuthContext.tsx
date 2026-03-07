import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Staff } from '../types'

interface AuthContextType {
  staff: Staff | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Simple hash for demo — in production use bcrypt via edge function
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('nfc_staff')
    if (stored) {
      try { setStaff(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  async function login(username: string, password: string): Promise<{ error?: string }> {
    const hash = await hashPassword(password)
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('password_hash', hash)
      .eq('is_active', true)
      .single()

    if (error || !data) return { error: 'Invalid username or password' }

    // Time-based login restriction (admins are exempt)
    if (data.role !== 'admin' && data.login_start && data.login_end) {
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const [sh, sm] = data.login_start.split(':').map(Number)
      const [eh, em] = data.login_end.split(':').map(Number)
      const start = sh * 60 + sm
      const end = eh * 60 + em
      const fmt = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        const ampm = h >= 12 ? 'PM' : 'AM'
        return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
      }
      if (cur < start || cur > end) {
        return { error: `Login allowed only between ${fmt(data.login_start)} and ${fmt(data.login_end)}` }
      }
    }

    setStaff(data)
    localStorage.setItem('nfc_staff', JSON.stringify(data))

    await supabase.from('activity_logs').insert({
      staff_id: data.id,
      action: 'LOGIN',
      details: `${data.name} logged in`
    })

    return {}
  }

  function logout() {
    setStaff(null)
    localStorage.removeItem('nfc_staff')
  }

  return (
    <AuthContext.Provider value={{ staff, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
