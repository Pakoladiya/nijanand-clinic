import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DeviceProvider, useDevice } from './context/DeviceContext'
import LoginPage from './pages/LoginPage'
import DeviceNotAuthorised from './pages/DeviceNotAuthorised'
import Layout from './components/Layout'
import RegisterPatient from './pages/RegisterPatient'
import AttendancePage from './pages/Attendance'
import PatientsPage from './pages/Patients'
import ExpensesPage from './pages/Expenses'
import AdminDashboard from './pages/AdminDashboard'
import ReceptionPage from './pages/Reception'
import QueuePage from './pages/Queue'
import './index.css'

function AppContent() {
  const { staff, loading: authLoading } = useAuth()
  const { isAuthorised, loading: deviceLoading } = useDevice()
  const [page, setPage] = useState('register')

  if (authLoading || deviceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full animate-pulse" style={{ backgroundColor: '#F6A000' }} />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorised) return <DeviceNotAuthorised />
  if (!staff) return <LoginPage />

  const renderPage = () => {
    switch (page) {
      case 'register': return <RegisterPatient />
      case 'attendance': return <AttendancePage />
      case 'patients': return <PatientsPage />
      case 'expenses': return <ExpensesPage />
      case 'admin': return <AdminDashboard />
      case 'reception': return <ReceptionPage />
      case 'queue': return <QueuePage />
      default: return <RegisterPatient />
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
