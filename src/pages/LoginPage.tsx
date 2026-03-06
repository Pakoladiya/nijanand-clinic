import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(username, password)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #fff8ed 0%, #f0fce8 100%)' }}>
      <div className="max-w-sm w-full">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-md"
            style={{ background: 'linear-gradient(135deg, #F6A000, #39A900)' }}>
            <svg viewBox="0 0 60 60" className="w-12 h-12" fill="none">
              <circle cx="30" cy="30" r="28" fill="#F6A000" />
              <path d="M30 8 C18 8 10 18 10 28 C10 40 20 52 30 52 C40 52 50 40 50 28 C50 18 42 8 30 8Z" fill="#39A900" opacity="0.4"/>
              <circle cx="30" cy="18" r="6" fill="white" />
              <path d="M18 38 Q24 28 30 26 Q36 28 42 38" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M22 44 L24 36 M38 44 L36 36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Nijanand</h1>
          <p className="font-semibold" style={{ color: '#39A900' }}>Fitness Centre</p>
          <p className="text-xs text-gray-400 mt-1">Clinic Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-bold text-gray-700 mb-6 text-center">Staff Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300 transition"
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
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#F6A000' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Nijanand Fitness Centre © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
