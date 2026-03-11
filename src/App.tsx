import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DeviceProvider, useDevice } from './context/DeviceContext'
import LoginPage from './pages/LoginPage'
import DeviceNotAuthorised from './pages/DeviceNotAuthorised'
import Layout from './components/Layout'
import RegisterPatient from './pages/RegisterPatient'
import AttendancePage from './pages/Attendance'
import PatientsPage from './pages/Patients'
import AdminDashboard from './pages/AdminDashboard'
import ReceptionPage from './pages/Reception'
import QueuePage from './pages/Queue'
import './index.css'

function AppContent() {
  const { staff, loading: authLoading } = useAuth()
  const { isAuthorised, loading: deviceLoading } = useDevice()
  const [page, setPage] = useState(() => localStorage.getItem('nfc_current_page') || 'register')
  // Used when navigating from Attendance → patient profile
  const [patientIdToOpen, setPatientIdToOpen] = useState<string | null>(null)

  // Persist current page so refresh stays on the same page
  useEffect(() => {
    localStorage.setItem('nfc_current_page', page)
  }, [page])

  if (authLoading || deviceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fff8ed 0%, #f0fce8 100%)' }}>
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.png" alt="NFC Logo" className="w-20 h-20 object-contain drop-shadow-md animate-pulse" />
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Nijanand</h1>
          <p className="text-base font-semibold" style={{ color: '#39A900' }}>Fitness Centre</p>
          <p className="text-xs text-gray-400 mt-3">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorised) return <DeviceNotAuthorised />
  if (!staff) return <LoginPage />

  /** Navigate to a page, optionally deep-linking to a specific patient */
  function navigateTo(p: string, patientId?: string) {
    setPage(p)
    if (patientId) setPatientIdToOpen(patientId)
  }

  const renderPage = () => {
    switch (page) {
      case 'register':    return <RegisterPatient />
      case 'attendance':  return <AttendancePage navigateTo={navigateTo} />
      case 'patients':    return (
        <PatientsPage
          patientIdToOpen={patientIdToOpen}
          onPatientOpened={() => setPatientIdToOpen(null)}
        />
      )
      case 'admin':       return <AdminDashboard navigateTo={navigateTo} />
      case 'reception':   return <ReceptionPage navigateTo={navigateTo} />
      case 'queue':       return <QueuePage navigateTo={navigateTo} />
      default:            return <RegisterPatient />
    }
  }

  return (
    <Layout page={page} setPage={setPage}>
      {renderPage()}
    </Layout>
  )
}

export default function App() {
  return (
    <DeviceProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DeviceProvider>
  )
}
