import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'
import { Users, Smartphone, Activity, Plus, Edit2, CheckCircle, XCircle, Shield, Eye, EyeOff, Settings, Search, Trash2, User, Clock, Download, Receipt, LogOut } from 'lucide-react'
import type { Staff, RegisteredDevice, ActivityLog, Patient } from '../types'
import ExpensesPage from './Expenses'

export default function AdminDashboard() {
  const { staff, logout } = useAuth()
  const [tab, setTab] = useState<'staff' | 'devices' | 'activity' | 'patients' | 'finance'>('staff')
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [devices, setDevices] = useState<RegisteredDevice[]>([])
  const [logs, setLogs] = useState<(ActivityLog & { staff: { name: string } | null })[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [patientLoading, setPatientLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [editPatientForm, setEditPatientForm] = useState({
    name: '', name_gujarati: '', age: '', gender: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '', address: '', chief_complaint: '',
    fees_type: 'per_session' as 'per_session' | 'package',
    fees_amount: '', registration_fee: '', referred_by: '',
  })
  const [editPatientLoading, setEditPatientLoading] = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [staffForm, setStaffForm] = useState({ name: '', role: 'staff' as 'admin' | 'staff', username: '', password: '' })
  const [showStaffPassword, setShowStaffPassword] = useState(false)
  const [prevSessionsEnabled, setPrevSessionsEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [editingTimeStaff, setEditingTimeStaff] = useState<string | null>(null)
  const [timeForm, setTimeForm] = useState({ start: '', end: '' })
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => {
    if (tab === 'staff') loadStaff()
    else if (tab === 'devices') loadDevices()
    else if (tab === 'activity') loadLogs()
    else if (tab === 'patients') loadPatients()
  }, [tab])

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const { data } = await supabase.from('clinic_settings').select('value').eq('key', 'previous_sessions_enabled').single()
    if (data) setPrevSessionsEnabled(data.value === 'true')
  }

  async function togglePrevSessions() {
    if (!staff) return
    setSettingsLoading(true)
    const newValue = !prevSessionsEnabled
    await supabase.from('clinic_settings').upsert({ key: 'previous_sessions_enabled', value: String(newValue), updated_at: new Date().toISOString() })
    await logActivity(staff.id, 'SETTING_CHANGED', `Previous sessions entry ${newValue ? 'enabled' : 'disabled'}`)
    setPrevSessionsEnabled(newValue)
    setSettingsLoading(false)
  }

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').order('created_at')
    setStaffList(data || [])
  }

  async function loadDevices() {
    const { data } = await supabase.from('registered_devices').select('*').order('created_at', { ascending: false })
    setDevices(data || [])
  }

  async function loadLogs() {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, staff:staff_id(name)')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs((data as any) || [])
  }

  async function loadPatients(search = patientSearch) {
    setPatientLoading(true)
    let query = supabase.from('patients').select('*').order('created_at', { ascending: false })
    if (search.trim().length >= 2) {
      query = query.or(`name.ilike.%${search}%,registration_number.ilike.%${search}%,phone.ilike.%${search}%`)
    }
    const { data } = await query.limit(50)
    setPatients(data || [])
    setPatientLoading(false)
  }

  async function deletePatient(patient: Patient) {
    if (!staff) return
    setDeleteLoading(true)
    await supabase.from('attendance').delete().eq('patient_id', patient.id)
    await supabase.from('payments').delete().eq('patient_id', patient.id)
    await supabase.from('packages').delete().eq('patient_id', patient.id)
    if (patient.photo_url) {
      await supabase.storage.from('patient-photos').remove([`${patient.registration_number}.jpg`])
    }
    await supabase.from('patients').delete().eq('id', patient.id)
    await logActivity(staff.id, 'PATIENT_DELETED', `Deleted patient: ${patient.name} (${patient.registration_number})`)
    setDeleteLoading(false)
    setDeleteConfirmId(null)
    loadPatients()
  }

  function startEditPatient(p: Patient) {
    setEditingPatient(p)
    setEditPatientForm({
      name: p.name,
      name_gujarati: p.name_gujarati || '',
      age: String(p.age),
      gender: p.gender,
      phone: p.phone,
      address: p.address,
      chief_complaint: p.chief_complaint,
      fees_type: p.fees_type,
      fees_amount: String(p.fees_amount),
      registration_fee: p.registration_fee != null ? String(p.registration_fee) : '',
      referred_by: p.referred_by || '',
    })
    setDeleteConfirmId(null)
  }

  async function savePatientEdit() {
    if (!staff || !editingPatient) return
    setEditPatientLoading(true)
    const updates = {
      name: editPatientForm.name.trim(),
      name_gujarati: editPatientForm.name_gujarati.trim() || null,
      age: parseInt(editPatientForm.age) || editingPatient.age,
      gender: editPatientForm.gender,
      phone: editPatientForm.phone.trim(),
      address: editPatientForm.address.trim(),
      chief_complaint: editPatientForm.chief_complaint.trim(),
      fees_type: editPatientForm.fees_type,
      fees_amount: parseFloat(editPatientForm.fees_amount) || 0,
      registration_fee: editPatientForm.registration_fee ? parseFloat(editPatientForm.registration_fee) : null,
      referred_by: editPatientForm.referred_by.trim() || null,
    }
    await supabase.from('patients').update(updates).eq('id', editingPatient.id)
    await logActivity(staff.id, 'PATIENT_UPDATED', `Updated patient: ${updates.name} (${editingPatient.registration_number})`)
    setEditPatientLoading(false)
    setEditingPatient(null)
    loadPatients()
  }

  async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function saveStaff() {
    if (!staff || !staffForm.name || !staffForm.username) return
    if (editingStaff) {
      const updates: any = { name: staffForm.name, role: staffForm.role, username: staffForm.username.toLowerCase() }
      if (staffForm.password) updates.password_hash = await hashPassword(staffForm.password)
      await supabase.from('staff').update(updates).eq('id', editingStaff.id)
      await logActivity(staff.id, 'STAFF_UPDATED', `Updated staff: ${staffForm.name}`)
    } else {
      if (!staffForm.password) return
      const hash = await hashPassword(staffForm.password)
      await supabase.from('staff').insert({ name: staffForm.name, role: staffForm.role, username: staffForm.username.toLowerCase(), password_hash: hash })
      await logActivity(staff.id, 'STAFF_CREATED', `Added new staff: ${staffForm.name}`)
    }
    setShowStaffForm(false)
    setEditingStaff(null)
    setStaffForm({ name: '', role: 'staff', username: '', password: '' })
    setShowStaffPassword(false)
    loadStaff()
  }

  async function toggleStaffActive(s: Staff) {
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
    await logActivity(staff!.id, 'STAFF_STATUS_CHANGED', `${s.is_active ? 'Deactivated' : 'Activated'} staff: ${s.name}`)
    loadStaff()
  }

  async function toggleDevice(d: RegisteredDevice) {
    await supabase.from('registered_devices').update({ is_active: !d.is_active }).eq('id', d.id)
    await logActivity(staff!.id, 'DEVICE_STATUS_CHANGED', `${d.is_active ? 'Deactivated' : 'Activated'} device: ${d.device_name}`)
    loadDevices()
  }

  function fmtTime(t: string) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  async function saveTimeRestriction(staffId: string) {
    await supabase.from('staff').update({
      login_start: timeForm.start || null,
      login_end: timeForm.end || null,
    }).eq('id', staffId)
    await logActivity(staff!.id, 'STAFF_TIME_UPDATED', `Updated login time for staff`)
    setEditingTimeStaff(null)
    loadStaff()
  }

  async function clearTimeRestriction(staffId: string, staffName: string) {
    await supabase.from('staff').update({ login_start: null, login_end: null }).eq('id', staffId)
    await logActivity(staff!.id, 'STAFF_TIME_UPDATED', `Removed login time restriction for ${staffName}`)
    setEditingTimeStaff(null)
    loadStaff()
  }

  function startEdit(s: Staff) {
    setEditingStaff(s)
    setStaffForm({ name: s.name, role: s.role, username: s.username, password: '' })
    setShowStaffPassword(false)
    setShowStaffForm(true)
    setEditingTimeStaff(null)
  }

  // ── Data Backup ──
  function toCSV(rows: any[]): string {
    if (rows.length === 0) return 'No data'
    const headers = Object.keys(rows[0])
    const escape = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""')
      return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
    }
    return [
      headers.join(','),
      ...rows.map(row => headers.map(h => escape(row[h])).join(','))
    ].join('\n')
  }

  async function downloadBackup() {
    if (!staff) return
    setBackupLoading(true)
    try {
      const [
        { data: patientsData },
        { data: attendanceData },
        { data: paymentsData },
        { data: expensesData },
        { data: packagesData },
        { data: waitingData },
      ] = await Promise.all([
        supabase.from('patients').select('*').order('created_at'),
        supabase.from('attendance').select('*').order('date'),
        supabase.from('payments').select('*').order('date'),
        supabase.from('expenses').select('*').order('date'),
        supabase.from('packages').select('*').order('created_at'),
        supabase.from('waiting_list').select('*').order('added_at'),
      ])

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const dateStr = format(new Date(), 'yyyy-MM-dd')

      zip.file('patients.csv', toCSV(patientsData || []))
      zip.file('attendance.csv', toCSV(attendanceData || []))
      zip.file('payments.csv', toCSV(paymentsData || []))
      zip.file('expenses.csv', toCSV(expensesData || []))
      zip.file('packages.csv', toCSV(packagesData || []))
      zip.file('waiting_list.csv', toCSV(waitingData || []))

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `NFC-Backup-${dateStr}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      await logActivity(staff.id, 'DATA_BACKUP', `Downloaded full data backup (${dateStr})`)
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`)
    } finally {
      setBackupLoading(false)
    }
  }

  if (staff?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-bold text-gray-600">Admin Access Only</h2>
        <p className="text-sm text-gray-400 mt-1">This section is restricted to admin users.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1 mb-5">
        {([['staff', 'Staff', Users], ['patients', 'Patients', User], ['devices', 'Devices', Smartphone], ['activity', 'Logs', Activity], ['finance', 'Finance', Receipt]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium border transition-colors"
            style={tab === key
              ? { backgroundColor: '#39A900', borderColor: '#39A900', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Staff Tab */}
      {tab === 'staff' && (
        <div className="space-y-3">
          <button onClick={() => { setShowStaffForm(true); setEditingStaff(null); setStaffForm({ name: '', role: 'staff', username: '', password: '' }); setShowStaffPassword(false) }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#F6A000' }}>
            <Plus size={16} /> Add New Staff
          </button>

          {showStaffForm && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-700">{editingStaff ? 'Edit Staff' : 'New Staff Member'}</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
                <input value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Dr. Name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role</label>
                  <select value={staffForm.role} onChange={e => setStaffForm(f => ({ ...f, role: e.target.value as any }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Username *</label>
                  <input value={staffForm.username} onChange={e => setStaffForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="username"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Password {editingStaff ? '(leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input type={showStaffPassword ? 'text' : 'password'} value={staffForm.password}
                    onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-orange-400" />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveStaff}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#39A900' }}>
                  {editingStaff ? 'Update' : 'Add Staff'}
                </button>
                <button onClick={() => { setShowStaffForm(false); setEditingStaff(null); setShowStaffPassword(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {staffList.map(s => (
              <div key={s.id} className="border-b last:border-0 border-gray-50">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: s.role === 'admin' ? '#39A900' : '#F6A000' }}>
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">@{s.username} • {s.role}</p>
                    {s.login_start && s.login_end && (
                      <p className="text-xs text-blue-500 mt-0.5">
                        ⏰ {fmtTime(s.login_start)} – {fmtTime(s.login_end)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-500">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (editingTimeStaff === s.id) { setEditingTimeStaff(null); return }
                        setTimeForm({ start: s.login_start?.slice(0, 5) ?? '', end: s.login_end?.slice(0, 5) ?? '' })
                        setEditingTimeStaff(s.id)
                        setShowStaffForm(false)
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        s.login_start
                          ? 'text-blue-600 border-blue-200 bg-blue-50'
                          : 'text-gray-500 border-gray-200 bg-gray-50'
                      }`}
                      title="Login time restriction">
                      <Clock size={12} />
                      <span>Time</span>
                    </button>
                    <button onClick={() => toggleStaffActive(s)}
                      className={`p-1.5 ${s.is_active ? 'text-green-500' : 'text-gray-300'}`}>
                      {s.is_active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </button>
                  </div>
                </div>

                {editingTimeStaff === s.id && (
                  <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">
                      Login Time Window — {s.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">From</label>
                        <input type="time" value={timeForm.start}
                          onChange={e => setTimeForm(f => ({ ...f, start: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">To</label>
                        <input type="time" value={timeForm.end}
                          onChange={e => setTimeForm(f => ({ ...f, end: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveTimeRestriction(s.id)}
                        disabled={!timeForm.start || !timeForm.end}
                        className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold bg-blue-500 disabled:opacity-50">
                        Save
                      </button>
                      {s.login_start && (
                        <button
                          onClick={() => clearTimeRestriction(s.id, s.name)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-red-200 text-red-500 bg-white">
                          Remove
                        </button>
                      )}
                      <button
                        onClick={() => setEditingTimeStaff(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 bg-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patients Tab */}
      {tab === 'patients' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
            <strong>⚠️ Admin Only:</strong> Deleting a patient removes all their visits, payments and records permanently. This cannot be undone.
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={patientSearch}
              onChange={e => {
                setPatientSearch(e.target.value)
                loadPatients(e.target.value)
              }}
              placeholder="Search by name, NFC no. or phone..."
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 bg-white"
            />
          </div>

          {patientLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
          ) : patients.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              {patientSearch.length >= 2 ? 'No patients found' : 'Type to search patients'}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {patients.map(p => (
                <div key={p.id} className="border-b last:border-0 border-gray-50">
                  <div className="flex items-center gap-3 px-4 py-3">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ backgroundColor: '#F6A000' }}>
                        {p.name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.registration_number} • {p.age}y, {p.gender}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => editingPatient?.id === p.id ? setEditingPatient(null) : startEditPatient(p)}
                        className="flex items-center gap-1 text-xs text-blue-500 border border-blue-200 px-2.5 py-1.5 rounded-xl hover:bg-blue-50">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(deleteConfirmId === p.id ? null : p.id)}
                        className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-2.5 py-1.5 rounded-xl hover:bg-red-50">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Edit Form */}
                  {editingPatient?.id === p.id && (
                    <div className="mx-4 mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-blue-700">Edit Patient — {p.registration_number}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
                          <input value={editPatientForm.name}
                            onChange={e => setEditPatientForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Name (Gujarati)</label>
                          <input value={editPatientForm.name_gujarati}
                            onChange={e => setEditPatientForm(f => ({ ...f, name_gujarati: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Age</label>
                          <input type="number" value={editPatientForm.age}
                            onChange={e => setEditPatientForm(f => ({ ...f, age: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Gender</label>
                          <select value={editPatientForm.gender}
                            onChange={e => setEditPatientForm(f => ({ ...f, gender: e.target.value as any }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Phone</label>
                          <input value={editPatientForm.phone}
                            onChange={e => setEditPatientForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Address</label>
                          <input value={editPatientForm.address}
                            onChange={e => setEditPatientForm(f => ({ ...f, address: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Chief Complaint</label>
                          <input value={editPatientForm.chief_complaint}
                            onChange={e => setEditPatientForm(f => ({ ...f, chief_complaint: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fees Type</label>
                          <select value={editPatientForm.fees_type}
                            onChange={e => setEditPatientForm(f => ({ ...f, fees_type: e.target.value as any }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                            <option value="per_session">Per Session</option>
                            <option value="package">Package</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fees Amount (₹)</label>
                          <input type="number" value={editPatientForm.fees_amount}
                            onChange={e => setEditPatientForm(f => ({ ...f, fees_amount: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Reg. Fee (₹)</label>
                          <input type="number" value={editPatientForm.registration_fee}
                            onChange={e => setEditPatientForm(f => ({ ...f, registration_fee: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Referred By</label>
                          <input value={editPatientForm.referred_by}
                            onChange={e => setEditPatientForm(f => ({ ...f, referred_by: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={savePatientEdit}
                          disabled={editPatientLoading || !editPatientForm.name.trim()}
                          className="flex-1 py-2 rounded-xl text-white text-xs font-semibold bg-blue-500 disabled:opacity-60">
                          {editPatientLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => setEditingPatient(null)}
                          className="flex-1 py-2 rounded-xl text-xs border border-gray-200 text-gray-600 bg-white">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteConfirmId === p.id && (
                    <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-700 mb-2">
                        Delete <strong>{p.name}</strong>? All visits, payments and records will be erased.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deletePatient(p)}
                          disabled={deleteLoading}
                          className="flex-1 py-2 rounded-xl text-white text-xs font-semibold bg-red-500 disabled:opacity-60">
                          {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 py-2 rounded-xl text-xs border border-gray-200 text-gray-600 bg-white">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
            <strong>Note:</strong> New devices register themselves using the admin password. You can deactivate a device if it's lost or needs to be removed.
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {devices.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No devices registered</p>
            ) : devices.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: d.is_active ? '#f0fce8' : '#f3f4f6' }}>
                  <Smartphone size={14} style={{ color: d.is_active ? '#39A900' : '#9ca3af' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.device_name}</p>
                  <p className="text-xs text-gray-400">{format(parseISO(d.created_at), 'dd MMM yyyy')}</p>
                </div>
                <button onClick={() => toggleDevice(d)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium ${d.is_active ? 'text-red-500 border border-red-200 hover:bg-red-50' : 'text-green-600 border border-green-200 hover:bg-green-50'}`}>
                  {d.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {logs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No activity recorded</p>
          ) : logs.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#F6A000' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{l.details}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(l.staff as any)?.name || 'Unknown'} • {format(parseISO(l.created_at), 'dd MMM, hh:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finance Tab */}
      {tab === 'finance' && <ExpensesPage />}

      {/* ── Settings & Backup (always visible at bottom) ── */}
      <div className="mt-6 space-y-4">
        {/* Feature Settings Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={15} className="text-gray-500" />
            <p className="text-sm font-semibold text-gray-700">Feature Settings</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Previous Sessions Entry</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {prevSessionsEnabled
                  ? 'ON — Staff can enter unlimited past sessions'
                  : 'OFF — Max 4 past sessions allowed'}
              </p>
            </div>
            <button
              onClick={togglePrevSessions}
              disabled={settingsLoading}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${prevSessionsEnabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${prevSessionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Data Backup Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Download size={15} className="text-gray-500" />
            <p className="text-sm font-semibold text-gray-700">Data Backup</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Downloads all patients, attendance, payments, expenses and packages as CSV files in a single ZIP.
          </p>
          <button
            onClick={downloadBackup}
            disabled={backupLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: backupLoading ? '#9ca3af' : '#3b82f6' }}>
            <Download size={15} />
            {backupLoading ? 'Preparing backup...' : 'Download Backup (.zip)'}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold border-2 border-red-100 text-red-500 bg-white hover:bg-red-50 transition-colors">
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  )
}
