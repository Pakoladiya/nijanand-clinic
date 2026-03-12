import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Phone, ChevronRight } from 'lucide-react'
import PatientProfile from './PatientProfile'
import type { Patient } from '../types'

interface Props {
  /** When set, auto-open this patient's profile (used for cross-page deep-link) */
  patientIdToOpen?: string | null
  onPatientOpened?: () => void
}

export default function PatientsPage({ patientIdToOpen, onPatientOpened }: Props) {
  const { staff } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Patient | null>(null)
  // attendance count (from DB) per patient — previous_sessions is added at display time
  const [attCounts, setAttCounts] = useState<Record<string, number>>({})

  // Auto-open a specific patient (e.g. navigated from Attendance list)
  useEffect(() => {
    if (!patientIdToOpen) return
    supabase.from('patients').select('*').eq('id', patientIdToOpen).single()
      .then(({ data }) => {
        if (data) {
          setSelected(data as Patient)
          onPatientOpened?.()
        }
      })
  }, [patientIdToOpen])

  useEffect(() => { loadPatients() }, [search])

  async function loadPatients() {
    setLoading(true)
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    let list: Patient[] = []

    if (search.length >= 2) {
      // Search: fetch matches + yesterday's attendees, sort yesterday-attendees first
      const [{ data: matched }, { data: yestAtt }] = await Promise.all([
        supabase.from('patients').select('*')
          .or(`name.ilike.%${search}%,registration_number.ilike.%${search}%,phone.ilike.%${search}%`)
          .order('created_at', { ascending: false }).limit(100),
        supabase.from('attendance').select('patient_id').eq('date', yesterday),
      ])
      const yestIds = new Set((yestAtt || []).map((a: any) => a.patient_id))
      const sorted = [...(matched || [])].sort((a, b) => {
        const aP = yestIds.has(a.id) ? 0 : 1
        const bP = yestIds.has(b.id) ? 0 : 1
        return aP - bP
      })
      list = sorted.slice(0, 50) as Patient[]
    } else {
      // No search: most recently registered first
      const { data } = await supabase.from('patients').select('*')
        .order('created_at', { ascending: false }).limit(50)
      list = (data || []) as Patient[]
    }

    setPatients(list)

    // Batch-fetch attendance counts for displayed patients
    if (list.length > 0) {
      const ids = list.map(p => p.id)
      const { data: attRows } = await supabase
        .from('attendance').select('patient_id').in('patient_id', ids)
      const map: Record<string, number> = {}
      attRows?.forEach((r: any) => { map[r.patient_id] = (map[r.patient_id] || 0) + 1 })
      setAttCounts(map)
    }

    setLoading(false)
  }

  if (selected) return (
    <PatientProfile
      patient={selected}
      onBack={() => { setSelected(null); loadPatients() }}
      onPatientUpdated={(p) => setSelected(p)}
    />
  )

  function maskPhone(phone: string) {
    if (staff?.role === 'admin') return phone
    return phone.slice(0, 5) + ' *****'
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, NFC number or phone..."
          className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : patients.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No patients found</div>
      ) : (
        <div className="space-y-2">
          {patients.map(p => {
            const totalVisits = (attCounts[p.id] || 0) + (p.previous_sessions || 0)
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 text-left hover:border-orange-200 transition-colors">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                    style={{ backgroundColor: '#F6A000' }}>
                    {p.name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.registration_number} • {p.age}y, {p.gender}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone size={10} /> {maskPhone(p.phone)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
                      {p.chief_complaint}
                    </span>
                    {totalVisits > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: '#f0fce8', color: '#39A900' }}>
                        {totalVisits} visits
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
