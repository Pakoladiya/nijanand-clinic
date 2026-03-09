import { useState, useEffect, useRef } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { Search, X, ClipboardList, UserCheck, Clock, Sun, Moon, Trash2, CalendarCheck } from 'lucide-react'
import type { Patient, WaitingEntry, Attendance } from '../types'

function getAutoSession(): 'morning' | 'evening' {
  return new Date().getHours() < 14 ? 'morning' : 'evening'
}

export default function ReceptionPage() {
  const { staff } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [session, setSession] = useState<'morning' | 'evening'>(getAutoSession())
  const [subTab, setSubTab] = useState<'waiting' | 'attended'>('waiting')

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Queue
  const [queue, setQueue] = useState<WaitingEntry[]>([])
  const [attended, setAttended] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // ── Load queue + attended on session change ──
  useEffect(() => {
    loadQueue()
    loadAttended()

    // Real-time subscription
    const channel = supabase
      .channel(`reception-${session}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waiting_list' },
        () => { loadQueue(); loadAttended() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  async function loadQueue() {
    const { data } = await supabase
      .from('waiting_list')
      .select('*, patients(name, registration_number)')
      .eq('date', today)
      .eq('session', session)
      .eq('status', 'waiting')
      .order('added_at')

    setQueue((data || []).map((row: any) => ({
      ...row,
      patient_name: row.patients?.name,
      registration_number: row.patients?.registration_number,
    })))
  }

  async function loadAttended() {
    const { data } = await supabase
      .from('attendance')
      .select('*, patients(name, registration_number)')
      .eq('date', today)
      .eq('session', session)
      .order('created_at')

    setAttended((data || []).map((row: any) => ({
      ...row,
      patient_name: row.patients?.name,
      registration_number: row.patients?.registration_number,
    })))
  }

  // ── Patient search with debounce + priority sort ──
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (searchQuery.length < 2) { setSearchResults([]); setShowDropdown(false); return }

    searchTimer.current = setTimeout(async () => {
      const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
      const [{ data: matched }, { data: yestAtt }] = await Promise.all([
        supabase.from('patients').select('*')
          .or(`name.ilike.%${searchQuery}%,registration_number.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('attendance').select('patient_id').eq('date', yesterday),
      ])
      const yestIds = new Set((yestAtt || []).map((a: any) => a.patient_id))
      const sorted = [...(matched || [])].sort((a, b) => {
        return (yestIds.has(a.id) ? 0 : 1) - (yestIds.has(b.id) ? 0 : 1)
      })
      setSearchResults(sorted.slice(0, 8))
      setShowDropdown(true)
    }, 300)
  }, [searchQuery])

  // ── Add patient to queue ──
  async function addToQueue(patient: Patient) {
    if (!staff) return
    setAddingId(patient.id)
    setShowDropdown(false)
    setSearchQuery('')

    // Check duplicate
    const { data: existing } = await supabase
      .from('waiting_list')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('date', today)
      .eq('session', session)
      .eq('status', 'waiting')
      .maybeSingle()

    if (existing) {
      alert(`${patient.name} is already in today's ${session} queue.`)
      setAddingId(null)
      return
    }

    await supabase.from('waiting_list').insert({
      patient_id: patient.id,
      date: today,
      session,
      added_by: staff.id,
      status: 'waiting',
      notes: '',
    })

    await logActivity(staff.id, 'QUEUE_ADDED',
      `Added ${patient.name} (${patient.registration_number}) to ${session} queue`)

    setAddingId(null)
    loadQueue()
  }

  // ── Remove from queue ──
  async function removeFromQueue(entry: WaitingEntry) {
    if (!staff) return
    if (!window.confirm(`Remove ${entry.patient_name} from the queue?`)) return
    setRemovingId(entry.id)
    await supabase.from('waiting_list').delete().eq('id', entry.id)
    await logActivity(staff.id, 'QUEUE_REMOVED',
      `Removed ${entry.patient_name} from ${session} queue`)
    setRemovingId(null)
    loadQueue()
  }

  // ── Format arrival time ──
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  // ── Wait duration ──
  function waitDuration(addedAt: string) {
    const mins = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const waitingCount = queue.length
  const attendedCount = attended.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#FEF3C7' }}>
          <ClipboardList size={20} style={{ color: '#F6A000' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Reception</h1>
          <p className="text-xs text-gray-400">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
        </div>
      </div>

      {/* Session toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSession('morning')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
          style={session === 'morning'
            ? { backgroundColor: '#FEF3C7', borderColor: '#F6A000', color: '#92400e' }
            : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
          <Sun size={15} /> Morning
        </button>
        <button
          onClick={() => setSession('evening')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
          style={session === 'evening'
            ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6', color: '#1d4ed8' }
            : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
          <Moon size={15} /> Evening
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-gray-800">{waitingCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Waiting</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-2xl font-bold" style={{ color: '#39A900' }}>{attendedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Attended</p>
        </div>
      </div>

      {/* Search box */}
      <div className="relative mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient to add to queue..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="w-full pl-9 pr-9 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-orange-300"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowDropdown(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {searchResults.map(p => (
              <button
                key={p.id}
                onMouseDown={() => addToQueue(p)}
                disabled={addingId === p.id}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.registration_number} · {p.phone}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
                  + Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setSubTab('waiting')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={subTab === 'waiting'
            ? { backgroundColor: 'white', color: '#F6A000', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { color: '#9ca3af' }}>
          <Clock size={13} /> Waiting ({waitingCount})
        </button>
        <button
          onClick={() => setSubTab('attended')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={subTab === 'attended'
            ? { backgroundColor: 'white', color: '#39A900', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { color: '#9ca3af' }}>
          <UserCheck size={13} /> Attended ({attendedCount})
        </button>
      </div>

      {/* Waiting list */}
      {subTab === 'waiting' && (
        <div className="space-y-2">
          {queue.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No patients in queue</p>
              <p className="text-xs mt-1">Search above to add patients</p>
            </div>
          ) : (
            queue.map((entry, i) => (
              <div key={entry.id}
                className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                {/* Position badge */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
                  {i + 1}
                </div>

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{entry.patient_name}</p>
                  <p className="text-xs text-gray-400">{entry.registration_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {formatTime(entry.added_at)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                      {waitDuration(entry.added_at)}
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFromQueue(entry)}
                  disabled={removingId === entry.id}
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Attended list */}
      {subTab === 'attended' && (
        <div className="space-y-2">
          {attended.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CalendarCheck size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No attended patients yet</p>
              <p className="text-xs mt-1">Therapist marks attendance from Queue page</p>
            </div>
          ) : (
            attended.map((entry, i) => (
              <div key={entry.id}
                className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#f0fce8' }}>
                  <UserCheck size={14} style={{ color: '#39A900' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{entry.patient_name}</p>
                  <p className="text-xs text-gray-400">{entry.registration_number} · Visit #{entry.visit_number}</p>
                </div>
                <span className="text-xs font-bold" style={{ color: '#39A900' }}>#{i + 1}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
