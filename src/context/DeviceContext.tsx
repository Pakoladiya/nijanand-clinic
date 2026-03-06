import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { getDeviceToken, setDeviceToken, generateDeviceToken } from '../lib/deviceGuard'

interface DeviceContextType {
  isAuthorised: boolean
  loading: boolean
  registerDevice: (deviceName: string, adminPassword: string) => Promise<{ error?: string }>
}

const DeviceContext = createContext<DeviceContextType | null>(null)

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [isAuthorised, setIsAuthorised] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkDevice()
  }, [])

  async function checkDevice() {
    const token = getDeviceToken()
    if (!token) { setLoading(false); return }

    const { data } = await supabase
      .from('registered_devices')
      .select('is_active')
      .eq('device_token', token)
      .single()

    setIsAuthorised(!!data?.is_active)
    setLoading(false)
  }

  async function registerDevice(deviceName: string, adminPassword: string): Promise<{ error?: string }> {
    // Verify admin password
    const encoder = new TextEncoder()
    const data = encoder.encode(adminPassword)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')

    const { data: adminStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('role', 'admin')
      .eq('password_hash', hashHex)
      .eq('is_active', true)
      .single()

    if (!adminStaff) return { error: 'Invalid admin password' }

    const token = generateDeviceToken()
    const { error } = await supabase.from('registered_devices').insert({
      device_token: token,
      device_name: deviceName,
      registered_by: adminStaff.id,
      is_active: true
    })

    if (error) return { error: 'Failed to register device' }

    setDeviceToken(token)
    setIsAuthorised(true)
    return {}
  }

  return (
    <DeviceContext.Provider value={{ isAuthorised, loading, registerDevice }}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useDevice must be inside DeviceProvider')
  return ctx
}
