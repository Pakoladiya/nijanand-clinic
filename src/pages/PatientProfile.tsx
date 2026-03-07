import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Phone, MapPin, Calendar, CreditCard, Plus, Download, Package } from 'lucide-react'
import type { Patient, Attendance, Payment } from '../types'

interface Props { patient: Patient; onBack: () => void }

export default function PatientProfile({ patient, onBack }: Props) {
  const { staff } = useAuth()
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tab, setTab] = useState<'visits' | 'fees'>('visits')
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', type: 'per_session' as Payment['payment_type'], notes: '', date: format(new Date(), 'yyyy-MM-dd'), sessions: '', start_date: format(new Date(), 'yyyy-MM-dd') })

  useEffect(() => { loadData() }, [patient.id])

  async function loadData() {
    const [{ data: att }, { data: pay }] = await Promise.all([
      supabase.from('attendance').select('*').eq('patient_id', patient.id).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('patient_id', patient.id).order('date', { ascending: false })
    ])
    setAttendance(att || [])
    setPayments(pay || [])
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const prevSessions = patient.previous_sessions || 0
  const totalVisits = attendance.length + prevSessions
  const sessionCost = totalVisits * patient.fees_amount
  const balance = totalPaid - sessionCost
  const isDue = balance < 0
  const isAdvance = balance > 0

  async function addPayment() {
    if (!staff || !payForm.amount) return
    const amount = parseFloat(payForm.amount)

    if (payForm.type === 'package') {
      await supabase.from('packages').insert({
        patient_id: patient.id, total_sessions: parseInt(payForm.sessions) || 10,
        amount_paid: amount, start_date: payForm.start_date, created_by: staff.id
      })
    }

    await supabase.from('payments').insert({
      patient_id: patient.id, amount, payment_type: payForm.type,
      date: payForm.date, staff_id: staff.id, notes: payForm.notes
    })

    await logActivity(staff.id, 'PAYMENT_ADDED',
      `Payment ₹${amount} for ${patient.name} (${patient.registration_number})`)

    setShowPaymentForm(false)
    setPayForm({ amount: '', type: 'per_session', notes: '', date: format(new Date(), 'yyyy-MM-dd'), sessions: '', start_date: format(new Date(), 'yyyy-MM-dd') })
    loadData()
  }

  function generateVCF() {
    if (staff?.role !== 'admin') return
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${patient.name} [${patient.registration_number}]\nTEL:${patient.phone}\nNOTE:NFC Patient - ${patient.chief_complaint}\nEND:VCARD`
    const blob = new Blob([vcf], { type: 'text/vcard' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${patient.name}-${patient.registration_number}.vcf`
    link.click()
  }

  const maskPhone = (phone: string) => staff?.role === 'admin' ? phone : phone.slice(0, 5) + ' *****'

  return (
    <div className="max-w-lg mx-auto pb-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Back to Patients
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-start gap-4">
          {patient.photo_url ? (
            <img src={patient.photo_url} alt={patient.name}
              className="w-20 h-20 rounded-2xl object-cover border-2" style={{ borderColor: '#F6A000' }} />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: '#F6A000' }}>
              {patient.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{patient.name}</h2>
            <p className="text-sm font-semibold" style={{ color: '#F6A000' }}>{patient.registration_number}</p>
            <p className="text-xs text-gray-400 mt-1">{patient.age} years • {patient.gender}</p>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
              {patient.chief_complaint}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={14} className="text-gray-400" />
            <span>{maskPhone(patient.phone)}</span>
            {staff?.role === 'admin' && (
              <button onClick={generateVCF}
                className="ml-auto text-xs px-2 py-1 rounded-lg border text-green-600 border-green-200 hover:bg-green-50 flex items-center gap-1">
                <Download size={10} /> Save Contact
              </button>
            )}
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs">{patient.address}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-xs">Registered: {format(parseISO(patient.created_at), 'dd MMM yyyy')}</span>
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
          ) : attendance.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: i === 0 ? '#39A900' : '#e5e7eb', color: i === 0 ? 'white' : '#374151' }}>
                {a.visit_number}
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
          ))}
        </div>
        </div>
      )}

      {/* Fees Tab */}
      {tab === 'fees' && (
        <div className="space-y-3">
          <button onClick={() => setShowPaymentForm(!showPaymentForm)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#39A900' }}>
            <Plus size={16} /> Add Payment
          </button>

          {showPaymentForm && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <div className="flex gap-2">
                {(['per_session', 'package', 'advance'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setPayForm(f => ({ ...f, type: t }))}
                    className="flex-1 py-2 rounded-xl text-xs font-medium border transition-colors"
                    style={payForm.type === t
                      ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                      : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                    {t === 'per_session' ? 'Per Session' : t === 'package' ? 'Package' : 'Advance'}
                  </button>
                ))}
              </div>

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

              {payForm.type === 'package' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sessions in package</label>
                    <input type="number" value={payForm.sessions}
                      onChange={e => setPayForm(f => ({ ...f, sessions: e.target.value }))}
                      placeholder="10"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Package Start Date</label>
                    <input type="date" value={payForm.start_date}
                      onChange={e => setPayForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                <input value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Cash, UPI, etc."
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

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No payments recorded</p>
            ) : payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: p.payment_type === 'package' ? '#f0fce8' : '#FEF3C7' }}>
                  {p.payment_type === 'package' ? <Package size={14} style={{ color: '#39A900' }} /> : <CreditCard size={14} style={{ color: '#F6A000' }} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">₹{p.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 capitalize">{p.payment_type.replace('_', ' ')} • {format(parseISO(p.date), 'dd MMM yyyy')}</p>
                  {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
