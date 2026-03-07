import { useState, useEffect } from 'react'
import { supabase, generateRegistrationNumber, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CameraCapture from '../components/CameraCapture'
import WelcomeImageModal from '../components/WelcomeImageModal'
import { UserPlus, CheckCircle, AlertCircle } from 'lucide-react'
import type { Patient } from '../types'

const COMPLAINTS = ['Back Pain', 'Neck Pain', 'Knee Pain', 'Shoulder Pain', 'Hip Pain',
  'Ankle Pain', 'Wrist Pain', 'Elbow Pain', 'Sports Injury', 'Post-Surgery Rehab', 'Other']

export default function RegisterPatient() {
  const { staff } = useAuth()
  const [form, setForm] = useState({
    name: '', age: '', gender: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '', address: '', referred_by: '',
    fees_type: 'per_session' as 'per_session' | 'package',
    fees_amount: '350',
  })
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([])
  const [otherComplaint, setOtherComplaint] = useState('')
  const [refSuggestions, setRefSuggestions] = useState<string[]>([])
  const [photo, setPhoto] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newPatient, setNewPatient] = useState<Patient | null>(null)

  useEffect(() => {
    supabase.from('patients').select('referred_by').not('referred_by', 'is', null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: any) => r.referred_by).filter(Boolean))] as string[]
          setRefSuggestions(unique)
        }
      })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleComplaint(c: string) {
    setSelectedComplaints(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staff) return
    const complaints = selectedComplaints.includes('Other')
      ? [...selectedComplaints.filter(c => c !== 'Other'), otherComplaint.trim()].filter(Boolean)
      : selectedComplaints
    if (form.phone.length !== 10) { setError('Please enter a valid 10-digit mobile number.'); return }
    if (complaints.length === 0) { setError('Please select at least one chief complaint.'); return }
    setLoading(true)
    setError('')

    try {
      const regNo = await generateRegistrationNumber()
      let photoUrl = null

      // Upload photo to Supabase Storage
      if (photo) {
        const base64 = photo.split(',')[1]
        const byteArr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([byteArr], { type: 'image/jpeg' })
        const fileName = `${regNo}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('patient-photos')
          .upload(fileName, blob, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('patient-photos').getPublicUrl(fileName)
          photoUrl = urlData.publicUrl
        }
      }

      const patientData = {
        registration_number: regNo,
        name: form.name.trim(),
        age: parseInt(form.age),
        gender: form.gender,
        phone: form.phone.trim(),
        address: form.address.trim(),
        photo_url: photoUrl,
        chief_complaint: complaints.join(', '),
        fees_type: form.fees_type,
        fees_amount: parseFloat(form.fees_amount),
        referred_by: form.referred_by.trim() || null,
        registered_by: staff.id,
      }

      const { data, error: insertError } = await supabase
        .from('patients').insert(patientData).select().single()

      if (insertError) throw insertError

      await logActivity(staff.id, 'PATIENT_REGISTERED',
        `Registered new patient: ${form.name} (${regNo})`)

      setNewPatient(data)
      setForm({ name: '', age: '', gender: 'Male', phone: '', address: '',
        referred_by: '', fees_type: 'per_session', fees_amount: '350' })
      setSelectedComplaints([])
      setOtherComplaint('')
      setPhoto('')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#FEF3C7' }}>
          <UserPlus size={20} style={{ color: '#F6A000' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">New Patient Registration</h1>
          <p className="text-sm text-gray-500">Nijanand Fitness Centre</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-4">Patient Photo</p>
          <CameraCapture onCapture={setPhoto} captured={photo} />
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Personal Information</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Patient's full name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Age *</label>
              <input type="number" value={form.age} onChange={e => set('age', e.target.value)}
                placeholder="Age" min="1" max="120"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender *</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value as any)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
            <input type="tel" value={form.phone}
              onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); set('phone', v) }}
              placeholder="10-digit mobile number"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors ${
                form.phone.length > 0 && form.phone.length !== 10
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-200 focus:border-orange-400'
              }`}
              required />
            {form.phone.length > 0 && form.phone.length !== 10 && (
              <p className="text-red-500 text-xs mt-1">
                {form.phone.length < 10 ? `${10 - form.phone.length} more digits needed` : 'Only 10 digits allowed'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Patient's address" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
              required />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ref. By</label>
            <input value={form.referred_by} onChange={e => set('referred_by', e.target.value)}
              placeholder="Referred by (optional)" list="ref-suggestions"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
            <datalist id="ref-suggestions">
              {refSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Chief Complaint</p>
            {selectedComplaints.length > 0 && (
              <span className="text-xs text-gray-400">{selectedComplaints.length} selected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPLAINTS.map(c => (
              <button type="button" key={c}
                onClick={() => toggleComplaint(c)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={selectedComplaints.includes(c)
                  ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                {c}
              </button>
            ))}
          </div>
          {selectedComplaints.includes('Other') && (
            <input value={otherComplaint} onChange={e => setOtherComplaint(e.target.value)}
              placeholder="Describe complaint"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
          )}
        </div>

        {/* Fees */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Fees for Welcome Card</p>
          <div className="flex gap-3">
            {(['per_session', 'package'] as const).map(type => (
              <button type="button" key={type}
                onClick={() => set('fees_type', type)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                style={form.fees_type === type
                  ? { backgroundColor: '#39A900', borderColor: '#39A900', color: 'white' }
                  : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
                {type === 'per_session' ? 'Per Session' : 'Package'}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {form.fees_type === 'per_session' ? 'Per Session Amount (₹)' : 'Package Amount (₹)'}
            </label>
            <input type="number" value={form.fees_amount}
              onChange={e => set('fees_amount', e.target.value)}
              placeholder="350"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-xl">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || selectedComplaints.length === 0}
          className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#F6A000' }}>
          {loading ? 'Registering...' : (
            <><CheckCircle size={18} /> Register Patient</>
          )}
        </button>
      </form>

      {/* Success — Show Welcome Image */}
      {newPatient && (
        <WelcomeImageModal patient={newPatient} onClose={() => setNewPatient(null)} />
      )}
    </div>
  )
}
