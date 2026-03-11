import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { Receipt, Plus, TrendingUp, TrendingDown, DollarSign, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Expense } from '../types'

const CATEGORIES = ['Rent', 'Electricity', 'Medical Supplies', 'Equipment', 'Staff Salary', 'Maintenance', 'Marketing', 'Miscellaneous']

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  per_session: 'Session Fee',
  package: 'Package',
  advance: 'Advance',
  registration_fee: 'Registration',
}

interface DailyPayment {
  id: string
  patient_id: string
  patient_name: string
  registration_number: string
  amount: number
  payment_type: string
  notes: string
  created_at: string
}

export default function ExpensesPage({
  navigateTo,
}: {
  navigateTo?: (page: string, patientId?: string) => void
}) {
  const { staff } = useAuth()
  const [view, setView] = useState<'daily' | 'monthly'>('daily')

  // ── Daily state ──
  const [viewDate, setViewDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dailyPayments, setDailyPayments] = useState<DailyPayment[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)

  // ── Monthly state ──
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [monthIncome, setMonthIncome] = useState(0)
  const [monthExpenses, setMonthExpenses] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
  const [viewMonth, setViewMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => { if (view === 'daily') loadDaily() }, [viewDate, view])
  useEffect(() => { if (view === 'monthly') loadMonthly() }, [viewMonth, view])

  // ── Load daily payments ──
  async function loadDaily() {
    setDailyLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, patients(name, registration_number)')
      .eq('date', viewDate)
      .order('created_at')

    setDailyPayments(
      (data || []).map((row: any) => ({
        id: row.id,
        patient_id: row.patient_id,
        patient_name: row.patients?.name ?? 'Unknown',
        registration_number: row.patients?.registration_number ?? '',
        amount: row.amount,
        payment_type: row.payment_type,
        notes: row.notes,
        created_at: row.created_at,
      }))
    )
    setDailyLoading(false)
  }

  // ── Load monthly data ──
  async function loadMonthly() {
    const start = format(startOfMonth(new Date(viewMonth + '-01')), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date(viewMonth + '-01')), 'yyyy-MM-dd')

    const [{ data: exp }, { data: pay }] = await Promise.all([
      supabase.from('expenses').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('payments').select('amount').gte('date', start).lte('date', end)
    ])

    setExpenses(exp || [])
    setMonthExpenses((exp || []).reduce((s, e) => s + e.amount, 0))
    setMonthIncome((pay || []).reduce((s, p) => s + p.amount, 0))
  }

  async function addExpense() {
    if (!staff || !form.amount || !form.description) return
    await supabase.from('expenses').insert({
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      added_by: staff.id
    })
    await logActivity(staff.id, 'EXPENSE_ADDED', `₹${form.amount} - ${form.category}: ${form.description}`)
    setForm({ category: 'Rent', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
    setShowForm(false)
    loadMonthly()
  }

  // ── Date navigation helpers ──
  function shiftDate(days: number) {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + days)
    setViewDate(format(d, 'yyyy-MM-dd'))
  }

  const isToday = viewDate === format(new Date(), 'yyyy-MM-dd')
  const dailyTotal = dailyPayments.reduce((s, p) => s + p.amount, 0)
  const netIncome = monthIncome - monthExpenses

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* View toggle */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setView('daily')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={view === 'daily'
            ? { backgroundColor: 'white', color: '#F6A000', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { color: '#9ca3af' }}>
          <CalendarDays size={13} /> Daily Collections
        </button>
        <button
          onClick={() => setView('monthly')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
          style={view === 'monthly'
            ? { backgroundColor: 'white', color: '#F6A000', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { color: '#9ca3af' }}>
          <Receipt size={13} /> Monthly
        </button>
      </div>

      {/* ══════════════ DAILY VIEW ══════════════ */}
      {view === 'daily' && (
        <>
          {/* Date navigator */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => shiftDate(-1)}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 active:scale-95">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1">
              <input
                type="date"
                value={viewDate}
                onChange={e => setViewDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white text-center font-medium"
              />
            </div>
            <button onClick={() => shiftDate(1)}
              disabled={isToday}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 active:scale-95 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Total collected banner */}
          <div className="rounded-2xl p-4 mb-4 flex items-center justify-between"
            style={{ backgroundColor: dailyTotal > 0 ? '#f0fce8' : '#f9fafb', border: `1px solid ${dailyTotal > 0 ? '#86efac' : '#e5e7eb'}` }}>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Total Collected</p>
              <p className="text-2xl font-bold" style={{ color: dailyTotal > 0 ? '#39A900' : '#9ca3af' }}>
                ₹{dailyTotal.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{format(parseISO(viewDate), 'dd MMM yyyy')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dailyPayments.length} payment{dailyPayments.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Payment list */}
          {dailyLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
          ) : dailyPayments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <CalendarDays size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No payments on this day</p>
              <p className="text-xs text-gray-300 mt-1">Try a different date</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {dailyPayments.map((p) => (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                    style={{ backgroundColor: '#F6A000' }}>
                    {p.patient_name[0]?.toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigateTo?.('patients', p.patient_id)}
                      className="text-sm font-semibold text-left hover:underline truncate block"
                      style={{ color: '#F6A000' }}>
                      {p.patient_name}
                    </button>
                    <p className="text-xs text-gray-400">
                      {p.registration_number}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </p>
                  </div>
                  {/* Amount + type */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#39A900' }}>₹{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{PAYMENT_TYPE_LABEL[p.payment_type] ?? p.payment_type}</p>
                  </div>
                </div>
              ))}
              {/* Footer total */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500">Total</p>
                <p className="text-sm font-bold" style={{ color: '#39A900' }}>₹{dailyTotal.toLocaleString()}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════ MONTHLY VIEW ══════════════ */}
      {view === 'monthly' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <Receipt size={20} style={{ color: '#F6A000' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Expenses & Finance</h2>
              <p className="text-xs text-gray-500">Monthly overview</p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="mb-4">
            <input type="month" value={viewMonth} onChange={e => setViewMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 bg-white" />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} style={{ color: '#39A900' }} />
                <p className="text-xs text-gray-500">Income</p>
              </div>
              <p className="text-lg font-bold" style={{ color: '#39A900' }}>₹{monthIncome.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={12} className="text-red-400" />
                <p className="text-xs text-gray-500">Expenses</p>
              </div>
              <p className="text-lg font-bold text-red-500">₹{monthExpenses.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-3 shadow-sm border ${netIncome >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} style={{ color: netIncome >= 0 ? '#39A900' : '#ef4444' }} />
                <p className="text-xs text-gray-500">Net</p>
              </div>
              <p className={`text-lg font-bold ${netIncome >= 0 ? '' : 'text-red-500'}`}
                style={{ color: netIncome >= 0 ? '#39A900' : undefined }}>
                ₹{Math.abs(netIncome).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Add Expense */}
          <button onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: '#F6A000' }}>
            <Plus size={16} /> Add Expense
          </button>

          {showForm && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. April rent payment"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addExpense}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#F6A000' }}>
                  Save Expense
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Expense List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {expenses.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No expenses for this month</p>
            ) : expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#FEF3C7' }}>
                  <Receipt size={14} style={{ color: '#F6A000' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400">{e.category} • {format(parseISO(e.date), 'dd MMM yyyy')}</p>
                </div>
                <p className="font-bold text-red-500 text-sm flex-shrink-0">-₹{e.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
