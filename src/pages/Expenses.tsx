import { useState, useEffect } from 'react'
import { supabase, logActivity } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { Receipt, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import type { Expense } from '../types'

const CATEGORIES = ['Rent', 'Electricity', 'Medical Supplies', 'Equipment', 'Staff Salary', 'Maintenance', 'Marketing', 'Miscellaneous']

export default function ExpensesPage() {
  const { staff } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [monthIncome, setMonthIncome] = useState(0)
  const [monthExpenses, setMonthExpenses] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') })
  const [viewMonth, setViewMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => { loadData() }, [viewMonth])

  async function loadData() {
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
    loadData()
  }

  const netIncome = monthIncome - monthExpenses

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
          <Receipt size={20} style={{ color: '#F6A000' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Expenses & Finance</h1>
          <p className="text-sm text-gray-500">Monthly overview</p>
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
    </div>
  )
}
