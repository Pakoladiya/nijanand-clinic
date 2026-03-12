import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, addDays, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Sun, Moon, Plus, Trash2, History, IndianRupee, X } from 'lucide-react'
import type { Attendance, Patient, Session, Package } from '../types'

interface AttendanceWithPatient extends Attendance {
  patients: { name: string; registration_number: string; previous_sessions: number | null } | null
}

interface Props {
  navigateTo?: (page: string, patientId?: string) => void
}

export default function AttendancePage({ navigateTo }: Props) {
  const { staff } = useAuth()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSession, setSelectedSession] = useState<Session>('morning')
  const [records, setRecords] = useState<AttendanceWithPatient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [attendedDates, setAttendedDates] = useState<Set<string>>(new Set())
  // Package context per patient for visit label display
  const [pkgInfo, setPkgInfo] = useState<Record<string, { pkg: Package; prevCount: number } | null>>({})

  // ── Payment prompt (today only) ──
  const [pendingPayPatient, setPendingPayPatient] = useState<Patient | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payType, setPayType] = useState('per_session')

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*, patients(name, registration_number, previous_sessions)')
      .eq('date', selectedDate)
      .eq('session', selectedSession)
      .order('created_at', { ascending: true })
    const recs = (data as AttendanceWithPatient[]) || []
    setRecords(recs)
    loadPkgInfo(recs)
  }, [selectedDate, selectedSession])

  // Batch-load package context for the session's patients
  async function loadPkgInfo(recs: AttendanceWithPatient[]) {
    if (recs.length === 0) { setPkgInfo({}); return }
    const pids = [...new Set(recs.map(r => r.patient_id))]

    // 1. Fetch all packages for these patients
    const { data: pkgs } = await supabase
      .from('packages').select('*')
      .in('patient_id', pids)
      .order('start_date', { ascending: true })

    // 2. Fetch all attendance dates for these patients (for pre-package count)
    const { data: allAtt } = await supabase
      .from('attendance').select('patient_id, date')
      .in('patient_id', pids)

    const result: Record<string, { pkg: Package; prevCount: number } | null> = {}
    pids.forEach(pid => {
      const patPkgs = ((pkgs || []) as Package[])
        .filter(p => p.patient_id === pid)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))

      // Find latest package covering selectedDate
      let latestPkg: Package | null = null
      for (let i = patPkgs.length - 1; i >= 0; i--) {
        if (selectedDate >= patPkgs[i].start_date) { latestPkg = patPkgs[i]; break }
      }

      if (!latestPkg) { result[pid] = null; return }

      const prevCount = (allAtt || [])
        .filter(a => a.patient_id === pid && a.date < latestPkg!.start_date).length

      result[pid] = { pkg: latestPkg, prevCount }
    })
    setPkgInfo(result)
  }

  // Load attendance dots for ±14 days around the selected date
  const loadNearbyAttendance = useCallback(async () => {
    const center = parseISO(selectedDate)
    const start = format(addDays(center, -14), 'yyyy-MM-dd')
    const end   = format(addDays(center,  14), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('attendance').select('date').gte('date', start).lte('date', end)
    setAttendedDates(new Set((data || []).map((r: any) => r.date)))
  }, [selectedDate])

  useEffect(() => { loadAttendance() },       [loadAttendance])
  useEffect(() => { loadNearbyAttendance() }, [loadNearbyAttendance])

  async function searchPatients(q: string) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    const [{ data: matched }, { data: yestAtt }] = await Promise.all([
      supabase.from('patients')
        .select('id, name, registration_number, chief_complaint, previous_sessions, fees_amount, fees_type')
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

  async function markAttendance(patient: Patient, payAmt = 0, pType = 'per_session') {
    if (!staff) return
    setLoading(true)
    setSearchQuery('')
    setSearchResults([])
    setPendingPayPatient(null)

    // ── Visit number logic ──────────────────────────────────────────────
    // If the patient has an active package, count only visits since that
    // package started (so each new package resets to visit #1).
    // If no package exists yet, count all visits + any pre-app sessions.

    const { data: latestPkg } = await supabase
      .from('packages')
      .select('id, start_date, total_sessions')
      .eq('patient_id', patient.id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let visitNumber: number
    if (latestPkg) {
      // Count visits on or after this package's start date
      const { count: pkgCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patient.id)
        .gte('date', latestPkg.start_date)
      visitNumber = (pkgCount || 0) + 1
    } else {
      // No package yet — purely sequential count of app-recorded sessions.
      // previous_sessions is NOT stored here; it is added at display time so
      // the shown total always equals (app visits + previous_sessions).
      const { count: totalCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patient.id)
      visitNumber = (totalCount || 0) + 1
    }
    // ───────────────────────────────────────────────────────────────────

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
      // Sync to waiting_list so Queue page shows this patient as attended
      if (!isRetroactive) {
        const { data: existingWL } = await supabase
          .from('waiting_list')
          .select('id, status')
          .eq('patient_id', patient.id)
          .eq('date', selectedDate)
          .eq('session', selectedSession)
          .maybeSingle()

        if (existingWL) {
          // Already in queue (e.g. added by reception) — mark as done
          if (existingWL.status === 'waiting') {
            await supabase.from('waiting_list')
              .update({ status: 'done' })
              .eq('id', existingWL.id)
          }
        } else {
          // Not in queue at all — insert as done so Queue shows 1 attended
          await supabase.from('waiting_list').insert({
            patient_id: patient.id,
            date: selectedDate,
            session: selectedSession,
            status: 'done',
            added_by: staff.id,
            added_at: new Date().toISOString(),
            notes: '',
          })
        }
      }

      // Record payment for today's entries only
      if (!isRetroactive && payAmt > 0) {
        await supabase.from('payments').insert({
          patient_id:   patient.id,
          amount:       payAmt,
          payment_type: pType,
          date:         selectedDate,
          staff_id:     staff.id,
          notes:        `${selectedSession} session — Visit #${visitNumber}`,
        })
      }
      const payNote = !isRetroactive && payAmt > 0 ? ` · ₹${payAmt} collected` : ''
      await logActivity(staff.id, 'ATTENDANCE_MARKED',
        `${patient.name} — ${selectedDate} ${selectedSession} (Visit #${visitNumber})${isRetroactive ? ' [RETROACTIVE]' : ''}${payNote}`)
      loadAttendance()
      loadNearbyAttendance()
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
    loadNearbyAttendance()
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = selectedDate !== todayStr
  const touchStartX = useRef<number>(0)

  function shiftDate(days: number) {
    setSelectedDate(prev => format(addDays(parseISO(prev), days), 'yyyy-MM-dd'))
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* ── Compact Date Slider ── */}
      <div className="bg-white rounded-2xl px-3 pt-3 pb-2 shadow-sm border border-gray-100 mb-4"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (Math.abs(dx) > 40) shiftDate(dx < 0 ? 1 : -1)
        }}>
        {/* Month label + Today jump */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-gray-500">
            {format(parseISO(selectedDate), 'MMMM yyyy')}
          </span>
          {isPastDate && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: '#FEF3C7', color: '#92400e' }}>
              Today
            </button>
          )}
        </div>

        {/* Arrow + 5 date chips */}
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex-shrink-0 transition-colors">
            <ChevronLeft size={17} />
          </button>

          <div className="flex-1 flex gap-1">
            {[-2, -1, 0, 1, 2].map(offset => {
              const date    = addDays(parseISO(selectedDate), offset)
              const dateStr = format(date, 'yyyy-MM-dd')
              const isSelected = offset === 0
              const isTodayDate = isToday(date)
              const hasAtt = attendedDates.has(dateStr)

              return (
                <button key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
                  style={
                    isSelected
                      ? { backgroundColor: '#F6A000', color: 'white' }
                      : isTodayDate
                        ? { backgroundColor: '#FEF3C7', color: '#92400e' }
                        : { color: '#6b7280' }
                  }>
                  <span className="text-xs font-medium leading-none">
                    {format(date, 'EEE')}
                  </span>
                  <span className="text-base font-bold leading-none mt-0.5">
                    {format(date, 'd')}
                  </span>
                  {/* Attendance dot — always reserve space to avoid layout shift */}
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-0.5 transition-opacity"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : '#39A900',
                      opacity: hasAtt ? 1 : 0,
                    }}
                  />
                </button>
              )
            })}
          </div>

          <button onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex-shrink-0 transition-colors">
            <ChevronRight size={17} />
          </button>
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

      {/* Date Info bar */}
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Selected</p>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              {format(parseISO(selectedDate), 'EEE, dd MMM yyyy')}
              {isPastDate && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                  <History size={9} /> Past
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{selectedSession === 'morning' ? 'Morning' : 'Evening'}</p>
            <p className="text-2xl font-bold" style={{ color: '#F6A000' }}>{records.length}</p>
            <p className="text-xs text-gray-400 -mt-0.5">patients</p>
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
                onClick={() => {
                  setSearchResults([])
                  setSearchQuery('')
                  if (!isPastDate) {
                    // Today — show payment prompt
                    setPendingPayPatient(p)
                    setPayAmount(p.fees_amount ? String(p.fees_amount) : '')
                    setPayType((p as any).fees_type ?? 'per_session')
                  } else {
                    // Past date — mark directly, no payment
                    markAttendance(p, 0, 'per_session')
                  }
                }}
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

        {/* ── Inline payment prompt ── */}
        {pendingPayPatient && (
          <div className="mt-3 bg-orange-50 rounded-xl p-3 border border-orange-200 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <IndianRupee size={12} /> Collect Payment — {pendingPayPatient.name}
              </p>
              <button onClick={() => setPendingPayPatient(null)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">₹</span>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-orange-400 bg-white"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 'per_session', label: 'Session' },
                { value: 'package', label: 'Package' },
                { value: 'advance', label: 'Advance' },
              ].map(t => (
                <button key={t.value} onClick={() => setPayType(t.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                  style={payType === t.value
                    ? { backgroundColor: '#F6A000', borderColor: '#F6A000', color: 'white' }
                    : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => markAttendance(pendingPayPatient, 0, 'per_session')}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 bg-white active:scale-95">
                Skip Payment
              </button>
              <button
                onClick={() => markAttendance(pendingPayPatient, parseFloat(payAmount) || 0, payType)}
                disabled={loading}
                className="py-2 px-4 rounded-xl text-xs font-bold text-white active:scale-95 flex items-center gap-1"
                style={{ backgroundColor: '#39A900', flex: 2 }}>
                <Plus size={12} /> Add & Save Payment
              </button>
            </div>
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
                  <button
                    onClick={() => navigateTo?.('patients', r.patient_id)}
                    className="text-sm font-semibold truncate text-left w-full hover:underline"
                    style={{ color: '#1a56db' }}>
                    {r.patients?.name || 'Unknown'}
                  </button>
                  <p className="text-xs text-gray-400">
                    {r.patients?.registration_number}
                    {' • '}
                    {(() => {
                      const pi = pkgInfo[r.patient_id]
                      // previous_sessions (before-app visits) are added to the raw
                      // sequential visit_number so the total matches the patient profile
                      const prevSessions = r.patients?.previous_sessions || 0
                      if (!pi) return `Visit #${r.visit_number + prevSessions}`
                      const prefix = pi.prevCount > 0 ? `${pi.prevCount}+` : ''
                      return (
                        <span className="font-semibold" style={{ color: '#39A900' }}>
                          {prefix}{r.visit_number}/{pi.pkg.total_sessions}
                        </span>
                      )
                    })()}
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
