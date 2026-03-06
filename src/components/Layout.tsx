import { type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserPlus, CalendarCheck, Users, Receipt, Shield, LogOut } from 'lucide-react'

interface NavItem { key: string; label: string; Icon: any; adminOnly?: boolean }

const NAV: NavItem[] = [
  { key: 'register', label: 'Register', Icon: UserPlus },
  { key: 'attendance', label: 'Attendance', Icon: CalendarCheck },
  { key: 'patients', label: 'Patients', Icon: Users },
  { key: 'expenses', label: 'Finance', Icon: Receipt },
  { key: 'admin', label: 'Admin', Icon: Shield, adminOnly: true },
]

interface LayoutProps { page: string; setPage: (p: string) => void; children: ReactNode }

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { staff, logout } = useAuth()


  const visibleNav = NAV.filter(n => !n.adminOnly || staff?.role === 'admin')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F6A000, #39A900)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <circle cx="12" cy="12" r="10" fill="#F6A000" />
                <circle cx="12" cy="7" r="2.5" fill="white" />
                <path d="M7 17 Q9.5 13 12 12 Q14.5 13 17 17" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 leading-none">Nijanand FC</p>
              <p className="text-xs text-gray-400 leading-none">{staff?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full font-medium"
              style={staff?.role === 'admin'
                ? { backgroundColor: '#f0fce8', color: '#39A900' }
                : { backgroundColor: '#FEF3C7', color: '#92400e' }}>
              {staff?.role === 'admin' ? 'Admin' : 'Staff'}
            </span>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-white border-t border-gray-100 shadow-lg sticky bottom-0 z-20">
        <div className="max-w-lg mx-auto flex">
          {visibleNav.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setPage(key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
              style={{ color: page === key ? '#F6A000' : '#9ca3af' }}>
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
              {page === key && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ backgroundColor: '#F6A000' }} />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
