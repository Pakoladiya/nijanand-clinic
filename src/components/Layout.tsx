import { type ReactNode, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserPlus, CalendarCheck, Users, Shield, ClipboardList, ListOrdered } from 'lucide-react'

interface NavItem { key: string; label: string; Icon: any; adminOnly?: boolean; staffOnly?: boolean }

const NAV: NavItem[] = [
  { key: 'register',   label: 'Register',   Icon: UserPlus,      adminOnly: true },
  { key: 'patients',   label: 'Patients',   Icon: Users },
  { key: 'attendance', label: 'Attendance', Icon: CalendarCheck, adminOnly: true },
  { key: 'reception',  label: 'Reception',  Icon: ClipboardList, staffOnly: true },
  { key: 'queue',      label: 'Queue',      Icon: ListOrdered,   adminOnly: true },
  { key: 'admin',      label: 'Admin',      Icon: Shield,        adminOnly: true },
]

interface LayoutProps { page: string; setPage: (p: string) => void; children: ReactNode }

export default function Layout({ page, setPage, children }: LayoutProps) {
  const { staff } = useAuth()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const visibleNav = NAV.filter(n => {
    if (n.adminOnly && staff?.role !== 'admin') return false
    if (n.staffOnly && staff?.role !== 'staff') return false
    return true
  })

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    // Ignore if movement is too small or mostly vertical (user is scrolling)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = visibleNav.findIndex(n => n.key === page)
    if (dx < 0 && idx < visibleNav.length - 1) setPage(visibleNav[idx + 1].key)  // swipe left → next
    if (dx > 0 && idx > 0)                     setPage(visibleNav[idx - 1].key)  // swipe right → prev
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="NFC Logo" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-800 leading-none">Nijanand FC</p>
              <p className="text-xs text-gray-400 leading-none">{staff?.name}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-medium"
            style={staff?.role === 'admin'
              ? { backgroundColor: '#f0fce8', color: '#39A900' }
              : { backgroundColor: '#FEF3C7', color: '#92400e' }}>
            {staff?.role === 'admin' ? 'Admin' : 'Staff'}
          </span>
        </div>
      </header>

      {/* Main Content — swipe left/right to change page */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-white border-t border-gray-100 shadow-lg sticky bottom-0 z-20">
        <div className="max-w-lg mx-auto flex">
          {visibleNav.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setPage(key)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative"
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
