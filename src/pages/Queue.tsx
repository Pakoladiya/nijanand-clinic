import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { ListOrdered, Sun, Moon, Clock, CheckCircle, UserCheck, ChevronDown, ChevronUp, RefreshCw, IndianRupee, X } from 'lucide-react'
import type { WaitingEntry } from '../types'

function getAutoSession(): 'morning' | 'evening' {
  return new Date().getHours() < 14 ? 'morning' : 'evening'
}

interface PaymentPrompt {
  entry: WaitingEntry
  defaultAmount: number
  defaultType: string
}

export default function QueuePage({ navigateTo }: { navigateTo?: (page: string, patientId?: string) => void }) {
  const { staff } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [session, setSession] = useState<'morning' | 'evening'>(getAutoSession())
  const [waiting, setWaiting]   = useState<WaitingEntry[]>([])
  const [done, setDone]         = useState<WaitingEntry[]>([])
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  // total attendance DB count per patient (previous_sessions added at display time)
  const [attCounts, setAttCounts] = useState<Record<string, number>>({})

  // ── Payment collection state ──
  const [payPrompt, setPayPrompt] = useState<PaymentPrompt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payType, setPayType] = useState('per_session')

  // ── Load + real-time subscription ──
  useEffect(() => {
    loadQueue()

    const channel = supabase
      .channel(`queue-admin-${session}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waiting_list' },
        () => loadQueue()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  async function loadQueue() {
    const { data } = await supabase
      .from('waiting_list')
      .select('*, patients(name, registration_number, fees_amount, fees_type, previous_sessions)')
      .eq('date', today)
      .eq('session', session)
      .order('added_at')

    const rows = (data || []).map((row: any) => ({
      ...row,
      patient_name: row.patients?.name,
      registration_number: row.patients?.registration_number,
      fees_amount: row.patients?.fees_amount ?? 0,
      fees_type: row.patients?.fees_type ?? 'per_session',
      previous_sessions: row.patients?.previous_sessions ?? 0,
    }))

    setWaiting(rows.filter((r: any) => r.status === 'waiting'))
    setDone(rows.filter((r: any) => r.status === 'done'))
    setLastUpdated(new Date())

    // Batch-fetch attendance counts for all queue patients
    const ids = [...new Set(rows.map((r: any) => r.patient_id as string))]
    if (ids.length > 0) {
      const { data: attRows } = await supabase
        .from('attendance').select('patient_id').in('patient_id', ids)
      const map: Record<string, number> = {}
      attRows?.forEach((r: any) => { map[r.patient_id] = (map[r.patient_id] || 0) + 1 })
      setAttCounts(map)
    }
  }

  // ── Open payment prompt ──
  function openPayPrompt(entry: any) {
    setPayPrompt({
      entry,
      defaultAmount: entry.fees_amount ?? 0,
      defaultType: entry.fees_type ?? 'per_session',
    })
    setPayAmount(entry.fees_amount ? String(entry.fees_amount) : '')
    setPayType(entry.fees_type ?? 'per_session')
  }

  // ── Mark patient as attended (with optional payment) ──
  async function markAttended(entry: WaitingEntry, amount: number, type: string | null) {
    if (!staff) return
    setMarkingId(entry.id)
    setPayPrompt(null)

    try {
      // 1. Get visit number
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', entry.patient_id)

      const visitNumber = (count || 0) + 1

      // 2. Create attendance record — upsert so a duplicate (e.g. already
      //    marked via Attendance page or auto-created at registration) is
      //    silently ignored rather than throwing an error
      const { error: attErr } = await supabase.from('attendance').upsert({
        patient_id:    entry.patient_id,
        date:          entry.date,
        session:       entry.session,
        visit_number:  visitNumber,
        marked_by:     staff.id,
        is_retroactive: false,
      }, { onConflict: 'patient_id,date,session', ignoreDuplicates: true })
      if (attErr) throw attErr

      // 3. Record payment if amount entered
      if (amount > 0 && type) {
        await supabase.from('payments').insert({
          patient_id:   entry.patient_id,
          amount,
          payment_type: type,
          date:         today,
          staff_id:     staff.id,
          notes:        `${entry.session} session — Visit #${visitNumber}`,
        })
      }

      // 4. Mark done in queue
      await supabase.from('waiting_list')
        .update({ status: 'done' })
        .eq('id', entry.id)

      // 5. Log activity
      const payNote = amount > 0 ? ` · ₹${amount} collected` : ' · No payment'
      await logActivity(staff.id, 'ATTENDANCE_MARKED',
        `Marked ${entry.patient_name} (${entry.registration_number}) as attended — ${entry.session} session, Visit #${visitNumber}${payNote}`)

      loadQueue()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setMarkingId(null)
    }
  }

  // ── Format helpers ──
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    })
  }

  function waitDuration(addedAt: string) {
    const mins = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min wait`
    return `${Math.floor(mins / 60)}h ${mins % 60}m wait`
  }

  function urgencyColor(addedAt: string) {
    const mins = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000)
    if (mins >= 30) return { bg: '#fef2f2', border: '#fca5a5', badge: '#ef4444' }
    if (mins >= 15) return { bg: '#fffbeb', border: '#fcd34d', badge: '#f59e0b' }
    return { bg: '#f0fce8', border: '#86efac', badge: '#39A900' }
  }

  const waitingCount = waiting.length
  const doneCount = done.length

  return (
    <div>
      {/* Last updated + refresh */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <p className="text-xs text-gray-400">
          🔴 Live · Updated {formatTime(lastUpdated.toISOString())}
        </p>
        <button onClick={loadQueue}
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw size={14} />
        </button>
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
          {session === 'morning' && waitingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: '#F6A000' }}>
              {waitingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSession('evening')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
          style={session === 'evening'
            ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6', color: '#1d4ed8' }
            : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#9ca3af' }}>
          <Moon size={15} /> Evening
          {session === 'evening' && waitingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: '#3b82f6' }}>
              {waitingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-2xl font-bold text-gray-800">{waitingCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Waiting</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
          <p className="text-2xl font-bold" style={{ color: '#39A900' }}>{doneCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Attended</p>
        </div>
      </div>

      {/* Waiting patients */}
      {waiting.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <ListOrdered size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Queue is empty</p>
          <p className="text-xs mt-1">Reception will add patients as they arrive</p>
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {waiting.map((entry: any, i) => {
            const colors = urgencyColor(entry.added_at)
            const isPrompting = payPrompt?.entry.id === entry.id
            return (
              <div key={entry.id}
                className="rounded-2xl p-4 border-2 transition-all"
                style={{ backgroundColor: colors.bg, borderColor: isPrompting ? '#F6A000' : colors.border }}>
                <div className="flex items-start gap-3">
                  {/* Position */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-white shadow-sm">
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigateTo?.('patients', entry.patient_id)}
                      className="text-base font-bold truncate text-left hover:underline"
                      style={{ color: '#F6A000' }}>
                      {entry.patient_name}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500">{entry.registration_number}</p>
                      {(() => {
                        const total = (attCounts[entry.patient_id] || 0) + ((entry as any).previous_sessions || 0)
                        return total > 0 ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: '#f0fce8', color: '#39A900' }}>
                            {total} visits
                          </span>
                        ) : null
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> Arrived {formatTime(entry.added_at)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                        style={{ backgroundColor: colors.badge }}>
                        {waitDuration(entry.added_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Payment prompt (inline) ── */}
                {isPrompting ? (
                  <div className="mt-3 bg-white rounded-xl p-3 border border-orange-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <IndianRupee size={12} /> Collect Payment
                      </p>
                      <button onClick={() => setPayPrompt(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Amount input */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-500">₹</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="0"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-orange-400"
                      />
                    </div>

                    {/* Payment type pills */}
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

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => markAttended(entry, 0, null)}
                        disabled={markingId === entry.id}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 bg-white active:scale-95">
                        Skip Payment
                      </button>
                      <button
                        onClick={() => markAttended(entry, parseFloat(payAmount) || 0, payType)}
                        disabled={markingId === entry.id}
                        className="flex-2 px-4 py-2 rounded-xl text-xs font-bold text-white active:scale-95 flex items-center justify-center gap-1"
                        style={{ backgroundColor: '#39A900', flex: 2 }}>
                        {markingId === entry.id
                          ? <><RefreshCw size={12} className="animate-spin" /> Saving...</>
                          : <><CheckCircle size={12} /> Confirm & Mark</>
                        }
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal mark attended button */
                  <button
                    onClick={() => openPayPrompt(entry)}
                    disabled={markingId === entry.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{ backgroundColor: markingId === entry.id ? '#9ca3af' : '#39A900' }}>
                    {markingId === entry.id ? (
                      <><RefreshCw size={14} className="animate-spin" /> Marking...</>
                    ) : (
                      <><CheckCircle size={14} /> Mark Attended</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Done section (collapsible) */}
      {doneCount > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowDone(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <UserCheck size={15} style={{ color: '#39A900' }} />
              <span className="text-sm font-semibold text-gray-700">
                Attended Today ({doneCount})
              </span>
            </div>
            {showDone ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showDone && (
            <div className="border-t border-gray-100">
              {done.map((entry: any, i) => (
                <div key={entry.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#f0fce8' }}>
                    <UserCheck size={12} style={{ color: '#39A900' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigateTo?.('patients', entry.patient_id)}
                      className="text-sm font-semibold truncate text-left hover:underline"
                      style={{ color: '#F6A000' }}>
                      {entry.patient_name}
                    </button>
                    <p className="text-xs text-gray-400">{entry.registration_number}</p>
                  </div>
                  <span className="text-xs text-gray-400">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
