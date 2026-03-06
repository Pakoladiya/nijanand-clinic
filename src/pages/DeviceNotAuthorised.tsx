import { useState } from 'react'
import { useDevice } from '../context/DeviceContext'
import { Shield, AlertCircle } from 'lucide-react'

export default function DeviceNotAuthorised() {
  const { registerDevice } = useDevice()
  const [deviceName, setDeviceName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceName.trim() || !adminPassword) return
    setLoading(true)
    setError('')
    const result = await registerDevice(deviceName.trim(), adminPassword)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: '#FEF3C7' }}>
              <Shield size={32} style={{ color: '#F6A000' }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Device Not Authorised</h1>
            <p className="text-gray-500 text-sm mt-2 text-center">
              This device is not registered to access<br />
              <strong>Nijanand Fitness Centre</strong> clinic system.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              Contact <strong>Dr. Piyush Koladiya</strong> (Admin) to register this device.
              Enter the device name and admin password below.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="e.g. Reception Desk, Dr. Piyush Mobile"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#F6A000' } as React.CSSProperties}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#F6A000' }}
            >
              {loading ? 'Registering...' : 'Register This Device'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
