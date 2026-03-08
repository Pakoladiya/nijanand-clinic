import { useState, useEffect, useCallback } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Sun, Moon, Plus, Trash2, History } from 'lucide-react'
import type { Attendance, Patient, Session } from '../types'

interface AttendanceWithPatient extends Attendance {
  patients: { name: string; registration_number: string } | null
}

export default function AttendancePage() {
  const { staff } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSession, setSelectedSession] = useState<Session>('morning')
  const [records, setRecords] = useState<AttendanceWithPatient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [attendedDates, setAttendedDates] = useState<Set<string>>(new Set())

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*, patients(name, registration_number)')
      .eq('date', selectedDate)
      .eq('session', selectedSession)
      .order('created_at', { ascending: true })
    setRecords((data as AttendanceWithPatient[]) || [])
  }, [selectedDate, selectedSession])

  const loadMonthAttendance = useCallback(async () => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('attendance').select('date').gte('date', start).lte('date', end)
    const dates = new Set((data || []).map((r: any) => r.date))
    setAttendedDates(dates)
  }, [currentMonth])

  useEffect(() => { loadAttendance() }, [loadAttendance])
  useEffect(() => { loadMonthAttendance() }, [loadMonthAttendance])

  async function searchPatients(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    const [{ data: matched }, { data: yestAtt }] = await Promise.all([
      supabase.from('patients').select('id, name, registration_number, chief_complaint')
        .or(`name.ilike.%${q}%,registration_number.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('attendance').select('patient_id').eq('date', yesterday),
    ])
    const yestIds = new Set((yestAtt || []).map((a: any) => a.patient_id))
    const sorted = [...(matched || [])].sort((a, b) => {
      const aP = yestIds.has(a.id) ? 0 : 1
      const bP = yestIds.has(b.id) ? 0 : 1
      return aP - bP
    })
    setSearchResults(sorted.slice(0, 8) as Patient[])
  }

  async function markAttendance(patient: Patient) {
    if (!staff) return
    setLoading(true)
    setSearchQuery('')
    setSearchResults([])

    // Count all previous visits for visit number
    const { count } = await supabase
      .from('attendance').select('*', { count: 'exact', head: true })
      .eq('patient_id', patient.id)
    const visitNumber = (count || 0) + 1

    const isRetroactive = selectedDate !== format(new Date(), 'yyyy-MM-dd')

    const { error } = await supabase.from('attendance').insert({
      patient_id: patient.id,
      date: selectedDate,
      session: selectedSession,
      visit_number: visitNumber,
      marked_by: staff.id,
      is_retroactive: isRetroactive,
      retroactive_added_by: isRetroactive ? staff.id : null,
      retroactive_added_at: isRetroactive ? new Date().toISOString() : null,
    })

    if (!error) {
      await logActivity(staff.id, 'ATTENDANCE_MARKED',
        `${patient.name} — ${selectedDate} ${selectedSession} (Visit #${visitNumber})${isRetroactive ? ' [RETROACTIVE]' : ''}`)
      loadAttendance()
      loadMonthAttendance()
    }
    setLoading(false)
  }

  async function deleteAttendance(id: string, patientName: string) {
    if (!staff) return
    if (!confirm(`Remove ${patientName} from this session?`)) return
    await supabase.from('attendance').delete().eq('id', id)
    await logActivity(staff.id, 'ATTENDANCE_DELETED',
      `Removed ${patientName} from ${selectedDate} ${selectedSession}`)
    loadAttendance()
    loadMonthAttendance()
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })
  const firstDayOfWeek = startOfMonth(currentMonth).getDay()

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f0fce8' }}>
          <Sun size={20} style={{ color: '#39A900' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Daily Attendance</h1>
          <p className="text-sm text-gray-500">Mark patient visits</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-gray-800">{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`e-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isSelected = dateStr === selectedDate
            const hasAttendance = attendedDates.has(dateStr)
            const todayDay = isToday(day)
            return (
              <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                className="aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors relative"
                style={isSelected
                  ? { backgroundColor: '#F6A000', color: 'white' }
                  : todayDay
                    ? { backgroundColor: '#FEF3C7', color: '#92400e' }
                    : { color: '#374151' }}>
                {format(day, 'd')}
                {hasAttendance && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: '#39A900' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Session Toggle */}
      <div className="flex gap-3 mb-4">
        {(['morning', 'evening'] as Session[]).map(s => (
          <button key={s} onClick={() => setSelectedSession(s)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm border transition-colors"
            style={selectedSession === s
              ? s === 'morning'
                ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                : { backgroundColor: '#1e3a5f', borderColor: '#1e3a5f', color: 'white' }
              : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#374151' }}>
            {s === 'morning' ? <Sun size={16} /> : <Moon size={16} />}
            {s === 'morning' ? 'Morning' : 'Evening'}
          </button>
        ))}
      </div>

      {/* Date Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Selected Date</p>
            <p className="font-semibold text-gray-800">
              {format(parseISO(selectedDate), 'dd MMM yyyy')}
              {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                  <History size={10} /> Past Date
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{selectedSession === 'morning' ? 'Morning' : 'Evening'} Session</p>
            <p className="font-bold text-2xl" style={{ color: '#F6A000' }}>{records.length}</p>
            <p className="text-xs text-gray-500">patients</p>
          </div>
        </div>
      </div>

      {/* Add Patient */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 relative">
        <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
          <Plus size={14} style={{ color: '#F6A000' }} /> Add Patient to Session
        </label>
        <input
          value={searchQuery}
          onChange={e => searchPatients(e.target.value)}
          placeholder="Search by name or NFC number..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
        />
        {searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            {searchResults.map(p => (
              <button key={p.id} type="button"
                onClick={() => markAttendance(p)}
                disabled={loading}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center justify-between border-b last:border-0 border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.registration_number} • {p.chief_complaint}</p>
                </div>
                <Plus size={16} style={{ color: '#F6A000' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">No patients added for this session yet</p>
          </div>
        ) : (
          <div>
            {records.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#F6A000' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {r.patients?.name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.patients?.registration_number} • Visit #{r.visit_number}
                    {r.is_retroactive && <span className="ml-1 text-amber-500">• Added late</span>}
                  </p>
                </div>
                <button onClick={() => deleteAttendance(r.id, r.patients?.name || '')}
                  className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
