import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Phone, MapPin, Calendar, CreditCard, Plus, Download,
  Package as PackageIcon, Trash2, Image, Pencil, X, Check,
} from 'lucide-react'
import WelcomeImageModal from '../components/WelcomeImageModal'
import type { Patient, Attendance, Payment, Package } from '../types'

const COMPLAINTS = [
  'Back Pain', 'Neck Pain', 'Knee Pain', 'Shoulder Pain', 'Hip Pain',
  'Ankle Pain', 'Wrist Pain', 'Elbow Pain', 'Sports Injury', 'Post-Surgery Rehab', 'Other',
]

interface Props {
  patient: Patient
  onBack: () => void
  onPatientUpdated?: (p: Patient) => void
}

export default function PatientProfile({ patient, onBack, onPatientUpdated }: Props) {
  const { staff } = useAuth()

  // Local copy of patient — updated after edits so display stays fresh
  const [localPatient, setLocalPatient] = useState<Patient>(patient)

  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [tab, setTab] = useState<'visits' | 'fees'>('visits')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showWelcomeCard, setShowWelcomeCard] = useState(false)
  const [pkgForm, setPkgForm] = useState({ sessions: '15', total_amount: '' })
  const [payForm, setPayForm] = useState({ amount: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') })

  // ── Edit patient state ────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: patient.name,
    name_gujarati: patient.name_gujarati || '',
    age: String(patient.age),
    gender: patient.gender as 'Male' | 'Female' | 'Other',
    phone: patient.phone,
    address: patient.address,
    chief_complaint: patient.chief_complaint,
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => { loadData() }, [patient.id])

  async function loadData() {
    const [{ data: att }, { data: pay }, { data: pkg }] = await Promise.all([
      supabase.from('attendance').select('*').eq('patient_id', patient.id).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('patient_id', patient.id).order('date', { ascending: false }),
      supabase.from('packages').select('*').eq('patient_id', patient.id).order('created_at'),
    ])
    setAttendance(att || [])
    setPayments(pay || [])
    setPackages(pkg || [])
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const prevSessions = localPatient.previous_sessions || 0
  const totalVisits = attendance.length + prevSessions
  const registrationFee = localPatient.registration_fee || 0
  const packageTotal = packages.reduce((s, p) => s + (p.total_amount || 0), 0)
  const totalOwed = registrationFee + packageTotal
  const balance = totalPaid - totalOwed
  const isDue = balance < 0
  const isAdvance = balance > 0

  async function addPayment() {
    if (!staff || !payForm.amount) return
    const amount = parseFloat(payForm.amount)
    await supabase.from('payments').insert({
      patient_id: patient.id, amount, payment_type: 'package',
      date: payForm.date, staff_id: staff.id, notes: payForm.notes,
    })
    await logActivity(staff.id, 'PAYMENT_ADDED',
      `Payment ₹${amount} for ${localPatient.name} (${localPatient.registration_number})`)
    setShowPaymentForm(false)
    setPayForm({ amount: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') })
    loadData()
  }

  async function createPackage() {
    if (!staff || !pkgForm.total_amount || !pkgForm.sessions) return

    // If no packages exist yet but the patient has prior attendance (unpaid sessions),
    // backdate the package start to their very first session so those sessions
    // count inside the package (e.g. 3 prior sessions → day 4 is 4/10, not 1/10).
    let startDate = format(new Date(), 'yyyy-MM-dd')
    if (packages.length === 0 && attendance.length > 0) {
      const earliest = [...attendance].sort((a, b) => a.date.localeCompare(b.date))[0]
      startDate = earliest.date
    }

    await supabase.from('packages').insert({
      patient_id: patient.id,
      total_sessions: parseInt(pkgForm.sessions),
      total_amount: parseFloat(pkgForm.total_amount),
      amount_paid: 0,
      start_date: startDate,
      created_by: staff.id,
    })
    await logActivity(staff.id, 'PACKAGE_CREATED',
      `Package: ${pkgForm.sessions} sessions ₹${pkgForm.total_amount} for ${localPatient.name}`)
    setShowPackageForm(false)
    setPkgForm({ sessions: '15', total_amount: '' })
    loadData()
  }

  // ── Save patient edits ────────────────────────────────────────────────────
  async function saveEdit() {
    if (!staff) return
    setEditError('')
    if (!editForm.name.trim()) { setEditError('Name is required'); return }
    if (!editForm.age || isNaN(Number(editForm.age))) { setEditError('Valid age required'); return }
    if (!editForm.phone.trim()) { setEditError('Phone is required'); return }

    setEditLoading(true)
    const updates = {
      name: editForm.name.trim(),
      name_gujarati: editForm.name_gujarati.trim() || null,
      age: parseInt(editForm.age),
      gender: editForm.gender,
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      chief_complaint: editForm.chief_complaint.trim(),
    }
    const { error } = await supabase.from('patients').update(updates).eq('id', patient.id)
    if (error) {
      setEditError('Failed to save. Please try again.')
      setEditLoading(false)
      return
    }
    const updated: Patient = { ...localPatient, ...updates }
    setLocalPatient(updated)
    onPatientUpdated?.(updated)
    await logActivity(staff.id, 'PATIENT_UPDATED',
      `Edited patient details: ${localPatient.name} (${localPatient.registration_number})`)
    setEditLoading(false)
    setShowEdit(false)
  }
  // ─────────────────────────────────────────────────────────────────────────

  function generateVCF() {
    if (staff?.role !== 'admin') return
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${localPatient.name} [${localPatient.registration_number}]\nTEL:${localPatient.phone}\nNOTE:NFC Patient - ${localPatient.chief_complaint}\nEND:VCARD`
    const blob = new Blob([vcf], { type: 'text/vcard' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${localPatient.name}-${localPatient.registration_number}.vcf`
    link.click()
  }

  async function deletePatient() {
    if (!staff) return
    setDeleteLoading(true)
    await supabase.from('attendance').delete().eq('patient_id', patient.id)
    await supabase.from('payments').delete().eq('patient_id', patient.id)
    await supabase.from('packages').delete().eq('patient_id', patient.id)
    if (localPatient.photo_url) {
      const fileName = `${localPatient.registration_number}.jpg`
      await supabase.storage.from('patient-photos').remove([fileName])
    }
    await supabase.from('patients').delete().eq('id', patient.id)
    await logActivity(staff.id, 'PATIENT_DELETED',
      `Deleted patient: ${localPatient.name} (${localPatient.registration_number})`)
    setDeleteLoading(false)
    onBack()
  }

  const maskPhone = (phone: string) =>
    staff?.role === 'admin' ? phone : phone.slice(0, 5) + ' *****'

  // ── Package-aware visit label ─────────────────────────────────────────────
  // Returns "X/Y" for first package, "N+X/Y" for subsequent packages,
  // or "Visit #N" when no package covers this attendance record.
  function visitLabel(att: Attendance): string {
    // For non-package visits, display = sequential visit_number + previous_sessions
    // so the label matches the "Total Visits" stat on the profile header.
    if (packages.length === 0) return `Visit #${att.visit_number + prevSessions}`

    // Sort packages oldest-first
    const sorted = [...packages].sort((a, b) => a.start_date.localeCompare(b.start_date))

    // Find the latest package whose start_date ≤ att.date
    let pkgIdx = -1
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (att.date >= sorted[i].start_date) { pkgIdx = i; break }
    }
    if (pkgIdx === -1) return `Visit #${att.visit_number + prevSessions}` // before any package

    const pkg = sorted[pkgIdx]

    // Sessions before this package's start (from all previous packages)
    const prevCount = attendance.filter(a => a.date < pkg.start_date).length

    // Sorted position within this package
    const pkgSessions = attendance
      .filter(a => a.date >= pkg.start_date)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date)
        return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
      })
    const posInPkg = pkgSessions.findIndex(a => a.id === att.id) + 1

    const prefix = prevCount > 0 ? `${prevCount}+` : ''
    return `${prefix}${posInPkg}/${pkg.total_sessions}`
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Patients
        </button>
        <div className="flex items-center gap-2">
          {/* Edit button — admin only */}
          {staff?.role === 'admin' && !showEdit && (
            <button onClick={() => {
              setEditForm({
                name: localPatient.name,
                name_gujarati: localPatient.name_gujarati || '',
                age: String(localPatient.age),
                gender: localPatient.gender,
                phone: localPatient.phone,
                address: localPatient.address,
                chief_complaint: localPatient.chief_complaint,
              })
              setEditError('')
              setShowEdit(true)
            }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
              <Pencil size={12} /> Edit
            </button>
          )}
          {staff?.role === 'admin' && (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Edit Form ── */}
      {showEdit && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-100 mb-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Pencil size={14} style={{ color: '#1a56db' }} /> Edit Patient Details
            </p>
            <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {editError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Name (English) *</label>
            <input value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Gujarati Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name (Gujarati)</label>
            <input value={editForm.name_gujarati}
              onChange={e => setEditForm(f => ({ ...f, name_gujarati: e.target.value }))}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Age + Gender row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Age *</label>
              <input type="number" value={editForm.age}
                onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gender *</label>
              <select value={editForm.gender}
                onChange={e => setEditForm(f => ({ ...f, gender: e.target.value as any }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone *</label>
            <input value={editForm.phone}
              onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input value={editForm.address}
              onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chief Complaint</label>
            <div className="flex flex-wrap gap-2">
              {COMPLAINTS.map(c => (
                <button key={c} type="button"
                  onClick={() => setEditForm(f => ({ ...f, chief_complaint: c }))}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={editForm.chief_complaint === c
                    ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                    : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                  {c}
                </button>
              ))}
            </div>
            {/* Free-text override if complaint not in list */}
            <input
              value={COMPLAINTS.includes(editForm.chief_complaint) ? '' : editForm.chief_complaint}
              onChange={e => setEditForm(f => ({ ...f, chief_complaint: e.target.value }))}
              placeholder="Or type custom complaint..."
              className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={saveEdit} disabled={editLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#1a56db' }}>
              <Check size={15} /> {editLoading ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setShowEdit(false)}
              className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-1">⚠️ Delete Patient?</p>
          <p className="text-xs text-red-600 mb-3">
            This will permanently delete <strong>{localPatient.name}</strong> and all their visits, payments and records. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={deletePatient} disabled={deleteLoading}
              className="flex-1 py-2 rounded-xl text-white text-sm font-semibold bg-red-500 disabled:opacity-60">
              {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-start gap-4">
          {localPatient.photo_url ? (
            <img src={localPatient.photo_url} alt={localPatient.name}
              className="w-20 h-20 rounded-2xl object-cover border-2" style={{ borderColor: '#F6A000' }} />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: '#F6A000' }}>
              {localPatient.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{localPatient.name}</h2>
            {localPatient.name_gujarati && (
              <p className="text-sm text-gray-400">{localPatient.name_gujarati}</p>
            )}
            <p className="text-sm font-semibold" style={{ color: '#F6A000' }}>{localPatient.registration_number}</p>
            <p className="text-xs text-gray-400 mt-1">{localPatient.age} years • {localPatient.gender}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
              {localPatient.chief_complaint}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={14} className="text-gray-400" />
            <span>{maskPhone(localPatient.phone)}</span>
            {staff?.role === 'admin' && (
              <button onClick={generateVCF}
                className="ml-auto text-xs px-2 py-1 rounded-lg border text-green-600 border-green-200 hover:bg-green-50 flex items-center gap-1">
                <Download size={10} /> Save Contact
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setShowWelcomeCard(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors"
              style={{ borderColor: '#F6A000', color: '#F6A000', backgroundColor: '#FEF3C7' }}>
              <Image size={12} /> Welcome Card
            </button>
            <span className="text-xs text-gray-400">Share / resend anytime</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs">{localPatient.address}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-xs">Registered: {format(parseISO(localPatient.created_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold" style={{ color: '#F6A000' }}>{totalVisits}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Visits</p>
          {prevSessions > 0 && (
            <p className="text-xs text-amber-500 mt-0.5">{attendance.length} recorded</p>
          )}
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-2xl font-bold" style={{ color: '#39A900' }}>₹{totalPaid.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Paid</p>
        </div>
        <div className={`rounded-xl p-3 shadow-sm border text-center ${isDue ? 'border-red-100 bg-red-50' : isAdvance ? 'border-green-100 bg-green-50' : 'bg-white border-gray-100'}`}>
          <p className={`text-2xl font-bold ${isDue ? 'text-red-500' : isAdvance ? 'text-green-600' : 'text-gray-400'}`}>
            ₹{Math.abs(balance).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{isDue ? 'Due' : isAdvance ? 'Advance' : 'Clear'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['visits', 'fees'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
            style={tab === t
              ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
            {t === 'visits' ? `Visits (${totalVisits})` : 'Fees & Payments'}
          </button>
        ))}
      </div>

      {/* Visits Tab */}
      {tab === 'visits' && (
        <div className="space-y-3">
          {prevSessions > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-lg">📋</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">{prevSessions} sessions before app</p>
                <p className="text-xs text-amber-600">Recorded manually at registration</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {attendance.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                {prevSessions > 0 ? 'No sessions recorded via app yet' : 'No visits recorded yet'}
              </p>
            ) : attendance.map((a) => {
              const label = visitLabel(a)
              const isPackageLabel = label.includes('/')
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                  <span className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg min-w-[2.5rem] text-center"
                    style={{
                      backgroundColor: isPackageLabel ? '#f0fce8' : '#f3f4f6',
                      color: isPackageLabel ? '#39A900' : '#374151',
                    }}>
                    {label}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {format(parseISO(a.date), 'dd MMM yyyy')}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {a.session} session
                      {a.is_retroactive && <span className="ml-1 text-amber-500">• Added late</span>}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ backgroundColor: a.session === 'morning' ? '#FEF3C7' : '#EFF6FF', color: a.session === 'morning' ? '#92400e' : '#1e40af' }}>
                    {a.session === 'morning' ? '☀️' : '🌙'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Welcome Card Modal */}
      {showWelcomeCard && (
        <WelcomeImageModal patient={localPatient} onClose={() => setShowWelcomeCard(false)} />
      )}

      {/* Fees Tab */}
      {tab === 'fees' && (
        <div className="space-y-3">

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={() => { setShowPackageForm(v => !v); setShowPaymentForm(false) }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#F6A000' }}>
              <PackageIcon size={15} /> Create Package
            </button>
            <button onClick={() => { setShowPaymentForm(v => !v); setShowPackageForm(false) }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#39A900' }}>
              <Plus size={15} /> Add Payment
            </button>
          </div>

          {/* Create Package Form */}
          {showPackageForm && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <p className="text-sm font-semibold text-gray-700">New Package Deal</p>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Number of Sessions</label>
                <div className="flex gap-2">
                  {['10', '15', '30'].map(s => (
                    <button key={s} type="button"
                      onClick={() => setPkgForm(f => ({ ...f, sessions: s }))}
                      className="flex-1 py-2 rounded-xl text-sm font-medium border transition-colors"
                      style={pkgForm.sessions === s
                        ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                        : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                      {s}
                    </button>
                  ))}
                  <input type="number"
                    value={!['10', '15', '30'].includes(pkgForm.sessions) ? pkgForm.sessions : ''}
                    onChange={e => setPkgForm(f => ({ ...f, sessions: e.target.value }))}
                    placeholder="Other"
                    className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Agreed Total Amount (₹)</label>
                <input type="number" value={pkgForm.total_amount}
                  onChange={e => setPkgForm(f => ({ ...f, total_amount: e.target.value }))}
                  placeholder="e.g. 3000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={createPackage}
                  disabled={!pkgForm.total_amount || !pkgForm.sessions}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#F6A000' }}>
                  Confirm Package
                </button>
                <button onClick={() => setShowPackageForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {showPaymentForm && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Record Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹) *</label>
                  <input type="number" value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" value={payForm.date}
                    onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <input value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Cash, UPI, partial payment..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={addPayment}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#39A900' }}>
                  Save Payment
                </button>
                <button onClick={() => setShowPaymentForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Registration Fee row */}
          {registrationFee > 0 && (
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                  <CreditCard size={14} style={{ color: '#F6A000' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Registration Fee</p>
                  <p className="text-xs text-gray-400">Day 1 charge</p>
                </div>
              </div>
              <p className="text-sm font-bold" style={{ color: '#F6A000' }}>₹{registrationFee.toLocaleString()}</p>
            </div>
          )}

          {/* Packages — sessions used = attendance records on/after package start_date */}
          {packages.map(pkg => {
            const pkgVisitsUsed = attendance.filter(a => a.date >= pkg.start_date).length
            const isComplete = pkgVisitsUsed >= pkg.total_sessions
            return (
              <div key={pkg.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: isComplete ? '#fef2f2' : '#f0fce8' }}>
                      <PackageIcon size={14} style={{ color: isComplete ? '#ef4444' : '#39A900' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{pkg.total_sessions} Sessions Package</p>
                      <p className="text-xs text-gray-400">{format(parseISO(pkg.start_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">₹{(pkg.total_amount || 0).toLocaleString()}</p>
                    {isComplete ? (
                      <p className="text-xs font-semibold text-red-400">✓ Complete</p>
                    ) : (
                      <p className="text-xs text-gray-400">agreed total</p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="pl-10">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400">
                      {pkgVisitsUsed} / {pkg.total_sessions} sessions used
                    </p>
                    <p className="text-xs font-medium" style={{ color: isComplete ? '#ef4444' : '#39A900' }}>
                      {Math.round((pkgVisitsUsed / pkg.total_sessions) * 100)}%
                    </p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (pkgVisitsUsed / pkg.total_sessions) * 100)}%`,
                        backgroundColor: isComplete ? '#ef4444' : '#39A900',
                      }} />
                  </div>
                  {isComplete && (
                    <p className="text-xs text-red-400 mt-1">
                      Package complete — next visit starts a new package count
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* Nudge if no package yet */}
          {packages.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-amber-700">No package yet. Tap <strong>Create Package</strong> once the deal is finalised.</p>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-1">Payment History</p>
            {payments.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6 pb-8">No payments recorded</p>
            ) : payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#f0fce8' }}>
                  <CreditCard size={14} style={{ color: '#39A900' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(p.date), 'dd MMM yyyy')}{p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
