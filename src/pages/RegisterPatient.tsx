import { useState, useEffect, useRef } from 'react'
import { supabase, generateRegistrationNumber, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CameraCapture from '../components/CameraCapture'
import WelcomeImageModal from '../components/WelcomeImageModal'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { Patient } from '../types'

const COMPLAINTS = ['Back Pain', 'Neck Pain', 'Knee Pain', 'Shoulder Pain', 'Hip Pain',
  'Ankle Pain', 'Wrist Pain', 'Elbow Pain', 'Sports Injury', 'Post-Surgery Rehab', 'Other']

const DRAFT_KEY = 'nfc_registration_draft'

export default function RegisterPatient() {
  const { staff } = useAuth()

  // Restore draft from localStorage on first load
  const savedDraft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null } })()

  const [form, setForm] = useState<{
    name: string; name_gujarati: string; age: string; gender: 'Male' | 'Female' | 'Other';
    phone: string; address: string; referred_by: string;
    first_day_fee: string;
    previous_sessions: string;
  }>(savedDraft?.form ?? {
    name: '', name_gujarati: '', age: '', gender: 'Male',
    phone: '', address: '', referred_by: '',
    first_day_fee: '100',
    previous_sessions: '0',
  })
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>(savedDraft?.selectedComplaints ?? [])
  const [otherComplaint, setOtherComplaint] = useState(savedDraft?.otherComplaint ?? '')
  const [hasDraft, setHasDraft] = useState(!!savedDraft)
  const [refSuggestions, setRefSuggestions] = useState<string[]>([])
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [showNameSugg, setShowNameSugg] = useState(false)
  const [showAddrSugg, setShowAddrSugg] = useState(false)
  const [prevSessionsEnabled, setPrevSessionsEnabled] = useState(false)
  const [photo, setPhoto] = useState<string>('')
  const [capturedPhotoForCard, setCapturedPhotoForCard] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [translitLoading, setTranslitLoading] = useState(false)
  const [gujaratiConfirmed, setGujaratiConfirmed] = useState(false)
  const translitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState('')
  const [newPatient, setNewPatient] = useState<Patient | null>(null)

  // Auto-save form to localStorage on every change
  useEffect(() => {
    const isEmpty = !form.name && !form.phone && !form.age
    if (isEmpty) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, selectedComplaints, otherComplaint }))
  }, [form, selectedComplaints, otherComplaint])

  useEffect(() => {
    supabase.from('patients').select('referred_by').not('referred_by', 'is', null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: any) => r.referred_by).filter(Boolean))] as string[]
          setRefSuggestions(unique)
        }
      })
    supabase.from('clinic_settings').select('value').eq('key', 'previous_sessions_enabled').single()
      .then(({ data }) => {
        if (data) setPrevSessionsEnabled(data.value === 'true')
      })
  }, [])

  const TITLE_CASE_FIELDS = ['name', 'address', 'referred_by']
  // Note: name_gujarati is excluded — Gujarati script doesn't use title case

  function toTitleCase(str: string) {
    return str.replace(/\b\w/g, c => c.toUpperCase())
  }

  function set(field: string, value: string) {
    const processed = TITLE_CASE_FIELDS.includes(field) ? toTitleCase(value) : value
    setForm(f => ({ ...f, [field]: processed }))
    if (field === 'name') {
      // Auto-transliterate English name → Gujarati after 600ms pause
      if (value.trim().length > 1) {
        if (translitTimer.current) clearTimeout(translitTimer.current)
        translitTimer.current = setTimeout(() => autoTransliterate(value.trim()), 600)
      }
      // Name suggestions with 300ms debounce
      if (nameTimer.current) clearTimeout(nameTimer.current)
      nameTimer.current = setTimeout(() => fetchNameSuggestions(value.trim()), 300)
    }
    if (field === 'address') {
      // Address suggestions with 300ms debounce
      if (addrTimer.current) clearTimeout(addrTimer.current)
      addrTimer.current = setTimeout(() => fetchAddressSuggestions(value.trim()), 300)
    }
  }

  async function autoTransliterate(englishName: string) {
    setTranslitLoading(true)
    setGujaratiConfirmed(false) // uncheck — staff must re-verify after auto-fill
    try {
      const words = englishName.split(/\s+/).filter(Boolean)
      const results = await Promise.all(words.map(async (word) => {
        const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=gu-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`
        const res = await fetch(url)
        const json = await res.json()
        return json?.[1]?.[0]?.[1]?.[0] ?? word
      }))
      setForm(f => ({ ...f, name_gujarati: results.join(' ') }))
    } catch {
      // Silently fail — staff can type manually
    }
    setTranslitLoading(false)
  }

  async function fetchNameSuggestions(q: string) {
    if (q.length < 2) { setNameSuggestions([]); setShowNameSugg(false); return }
    const { data } = await supabase.from('patients').select('name')
      .ilike('name', `%${q}%`).order('name').limit(6)
    const unique = [...new Set((data || []).map((r: any) => r.name as string))]
    setNameSuggestions(unique)
    setShowNameSugg(unique.length > 0)
  }

  async function fetchAddressSuggestions(q: string) {
    if (q.length < 3) { setAddressSuggestions([]); setShowAddrSugg(false); return }
    const { data } = await supabase.from('patients').select('address')
      .ilike('address', `%${q}%`).limit(20)
    const unique = [...new Set((data || []).map((r: any) => r.address as string).filter(Boolean))]
    setAddressSuggestions(unique.slice(0, 6))
    setShowAddrSugg(unique.length > 0)
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
        if (uploadError) {
          console.error('Photo upload error:', uploadError.message)
          // Continue registration without photo rather than blocking
        } else {
          const { data: urlData } = supabase.storage.from('patient-photos').getPublicUrl(fileName)
          photoUrl = urlData.publicUrl
        }
      }

      const patientData = {
        registration_number: regNo,
        name: form.name.trim(),
        name_gujarati: form.name_gujarati.trim() || null,
        age: parseInt(form.age),
        gender: form.gender,
        phone: form.phone.trim(),
        address: form.address.trim(),
        photo_url: photoUrl,
        chief_complaint: complaints.join(', '),
        registration_fee: parseFloat(form.first_day_fee) || 0,
        fees_type: 'per_session',  // kept for DB compatibility
        fees_amount: 0,            // kept for DB compatibility
        referred_by: form.referred_by.trim() || null,
        previous_sessions: parseInt(form.previous_sessions) || 0,
        registered_by: staff.id,
      }

      const { data, error: insertError } = await supabase
        .from('patients').insert(patientData).select().single()

      if (insertError) throw insertError

      // Auto-record first day charge as a payment
      const firstDayFee = parseFloat(form.first_day_fee) || 0
      if (firstDayFee > 0) {
        await supabase.from('payments').insert({
          patient_id: data.id,
          amount: firstDayFee,
          payment_type: 'registration_fee',
          date: format(new Date(), 'yyyy-MM-dd'),
          staff_id: staff.id,
          notes: 'Day 1 registration charge',
        })
      }

      await logActivity(staff.id, 'PATIENT_REGISTERED',
        `Registered new patient: ${form.name} (${regNo})`)

      setCapturedPhotoForCard(photo)   // save before clearing, so WelcomeImageModal can use it
      setNewPatient(data)
      localStorage.removeItem(DRAFT_KEY)
      setHasDraft(false)
      setGujaratiConfirmed(false)
      setForm({ name: '', name_gujarati: '', age: '', gender: 'Male', phone: '', address: '',
        referred_by: '', first_day_fee: '100', previous_sessions: '0' })
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
      {hasDraft && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <p className="text-xs font-medium text-blue-700">Draft restored — your previous data is back!</p>
          </div>
          <button type="button" onClick={() => {
            localStorage.removeItem(DRAFT_KEY)
            setHasDraft(false)
            setForm({ name: '', name_gujarati: '', age: '', gender: 'Male', phone: '', address: '', referred_by: '', first_day_fee: '100', previous_sessions: '0' })
            setSelectedComplaints([])
            setOtherComplaint('')
          }} className="text-xs text-blue-500 underline ml-2">Clear</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Personal Information</p>

          {/* Name + Photo side by side */}
          <div className="flex items-start gap-3">
            <CameraCapture onCapture={setPhoto} captured={photo} />
            <div className="flex-1 relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              onBlur={() => setTimeout(() => setShowNameSugg(false), 150)}
              onFocus={() => nameSuggestions.length > 0 && setShowNameSugg(true)}
              placeholder="Patient's full name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              required />
            {showNameSugg && nameSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <p className="text-xs text-gray-400 px-3 pt-2 pb-1">Already registered:</p>
                {nameSuggestions.map(s => (
                  <button key={s} type="button"
                    onMouseDown={() => { set('name', s); setShowNameSugg(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 border-t border-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                Name (Gujarati)
                {translitLoading && (
                  <span className="text-orange-500 animate-pulse">⟳ Translating...</span>
                )}
              </label>
              {/* Verification checkbox — appears once Gujarati field has content */}
              {form.name_gujarati && !translitLoading && (
                <label className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer px-2.5 py-1 rounded-lg border transition-colors ${
                  gujaratiConfirmed
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-amber-50 border-amber-300 text-amber-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={gujaratiConfirmed}
                    onChange={e => setGujaratiConfirmed(e.target.checked)}
                    className="w-3.5 h-3.5 accent-green-500"
                  />
                  {gujaratiConfirmed ? '✓ Verified' : 'Verify'}
                </label>
              )}
            </div>
            <input
              value={form.name_gujarati}
              onChange={e => { set('name_gujarati', e.target.value); setGujaratiConfirmed(false) }}
              placeholder="Auto-filled in Gujarati — edit if needed"
              lang="gu"
              inputMode="text"
              autoCorrect="off"
              autoComplete="off"
              className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none border transition-colors ${
                form.name_gujarati && gujaratiConfirmed
                  ? 'border-green-400 bg-green-50 focus:border-green-500'
                  : form.name_gujarati && !gujaratiConfirmed
                  ? 'border-amber-300 focus:border-orange-400'
                  : 'border-gray-200 focus:border-orange-400'
              }`}
              style={{ fontFamily: "'Anek Gujarati', sans-serif" }}
            />
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

          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)}
              onBlur={() => setTimeout(() => setShowAddrSugg(false), 150)}
              onFocus={() => addressSuggestions.length > 0 && setShowAddrSugg(true)}
              placeholder="Patient's address" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none leading-tight"
              required />
            {showAddrSugg && addressSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <p className="text-xs text-gray-400 px-3 pt-2 pb-1">Previously used addresses:</p>
                {addressSuggestions.map(s => (
                  <button key={s} type="button"
                    onMouseDown={() => { set('address', s); setShowAddrSugg(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 border-t border-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}
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

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <label className="block text-xs font-medium text-amber-800 mb-1">
              Previous Sessions (for existing patients only)
            </label>
            <input type="number" min="0" max={prevSessionsEnabled ? 9999 : 4}
              value={form.previous_sessions}
              onChange={e => {
                const val = parseInt(e.target.value) || 0
                const max = prevSessionsEnabled ? 9999 : 4
                set('previous_sessions', String(Math.min(val, max)))
              }}
              placeholder="0"
              className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white" />
            <p className="text-xs text-amber-600 mt-1">
              {prevSessionsEnabled
                ? 'Feature ON — Enter any number of past sessions.'
                : 'Max 4 sessions. Admin can enable unlimited entry in Admin panel.'}
            </p>
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

        {/* First Day Charge */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">First Day Charge</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">Auto-recorded as payment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-gray-400">₹</span>
            <input type="number" value={form.first_day_fee}
              onChange={e => set('first_day_fee', e.target.value)}
              placeholder="100"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <p className="text-xs text-gray-400">Package deal (10 / 15 / 30 sessions) can be added from the patient's profile after registration.</p>
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
        <WelcomeImageModal
          patient={newPatient}
          capturedPhoto={capturedPhotoForCard}
          onClose={() => { setNewPatient(null); setCapturedPhotoForCard('') }}
        />
      )}
    </div>
  )
}
