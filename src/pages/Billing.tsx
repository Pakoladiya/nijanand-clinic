import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { Search, Printer, X } from 'lucide-react'
import type { Patient } from '../types'

interface ChargeRow {
  label: string
  chargePerDay: string
  days: string
  visitsPerDay: string
}

function rowAmt(r: ChargeRow): number {
  return (parseFloat(r.chargePerDay) || 0) * (parseFloat(r.days) || 0) * (parseFloat(r.visitsPerDay) || 0)
}

function toWords(n: number): string {
  if (n === 0) return 'Zero Only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function two(x: number) { return x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '') }
  function three(x: number) { return x < 100 ? two(x) : ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') }
  let r = '', x = Math.floor(n)
  if (x >= 10000000) { r += three(Math.floor(x / 10000000)) + ' Crore '; x %= 10000000 }
  if (x >= 100000)   { r += three(Math.floor(x / 100000))  + ' Lakh ';  x %= 100000 }
  if (x >= 1000)     { r += two(Math.floor(x / 1000))      + ' Thousand '; x %= 1000 }
  if (x > 0)         r += three(x)
  return r.trim() + ' Only'
}

export default function BillingPage() {
  const [search, setSearch]           = useState('')
  const [suggestions, setSuggestions] = useState<Patient[]>([])
  const [patient, setPatient]         = useState<Patient | null>(null)
  const [diagnosis, setDiagnosis]     = useState('')
  const [rows, setRows]               = useState<ChargeRow[]>([
    { label: 'A) Assessment Charge', chargePerDay: '', days: '', visitsPerDay: '' },
    { label: 'B) Treatment Charge',  chargePerDay: '', days: '', visitsPerDay: '' },
    { label: 'C) Other Charge',      chargePerDay: '', days: '', visitsPerDay: '' },
  ])
  const [billNo, setBillNo]           = useState<number | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy]               = useState(false)

  async function onSearch(q: string) {
    setSearch(q)
    if (q.length < 2) { setSuggestions([]); return }
    const { data } = await supabase.from('patients').select('*')
      .or(`name.ilike.%${q}%,registration_number.ilike.%${q}%`).limit(6)
    setSuggestions(data || [])
  }

  async function handleGenerate() {
    if (!patient) return
    setBusy(true)
    const { data } = await supabase.from('clinic_settings')
      .select('value').eq('key', 'last_bill_number').single()
    const next = (parseInt(data?.value || '0') || 0) + 1
    await supabase.from('clinic_settings').upsert({
      key: 'last_bill_number', value: String(next),
      updated_at: new Date().toISOString(),
    })
    setBillNo(next)
    setBusy(false)
    setShowPreview(true)
  }

  function updateRow(i: number, field: keyof ChargeRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const total = rows.reduce((s, r) => s + rowAmt(r), 0)

  return (
    <div className="space-y-3">
      {/* Patient + Diagnosis */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Patient</p>

        {!patient ? (
          <div className="relative">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => onSearch(e.target.value)}
                placeholder="Search by name or reg. number"
                className="flex-1 text-sm outline-none bg-transparent" />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {suggestions.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={() => { setPatient(p); setSuggestions([]); setSearch('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-t border-gray-50 first:border-0">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{p.registration_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">{patient.name}</p>
              <p className="text-xs text-gray-500">{patient.registration_number} · {patient.age} yrs · {patient.gender}</p>
            </div>
            <button onClick={() => { setPatient(null); setDiagnosis('') }} className="text-gray-400 p-1">
              <X size={15} />
            </button>
          </div>
        )}

        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
          placeholder="Diagnosis"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400" />
      </div>

      {/* Charges */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Charges</p>
        <div className="grid grid-cols-4 gap-1 mb-2 px-0.5">
          {['₹/Day', 'Days', 'Visits', 'Amount'].map(h => (
            <p key={h} className="text-xs text-center font-medium text-gray-400">{h}</p>
          ))}
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-gray-600 mb-1">{row.label}</p>
              <div className="grid grid-cols-4 gap-1">
                <input value={row.chargePerDay} onChange={e => updateRow(i, 'chargePerDay', e.target.value)}
                  type="number" placeholder="0"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-orange-400" />
                <input value={row.days} onChange={e => updateRow(i, 'days', e.target.value)}
                  type="number" placeholder="0"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-orange-400" />
                <input value={row.visitsPerDay} onChange={e => updateRow(i, 'visitsPerDay', e.target.value)}
                  type="number" placeholder="0"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-orange-400" />
                <div className="border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-center bg-gray-50 font-medium text-gray-700">
                  {rowAmt(row) > 0 ? rowAmt(row).toLocaleString('en-IN') : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-base font-bold" style={{ color: '#F6A000' }}>
            ₹{total.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <button onClick={handleGenerate} disabled={!patient || busy}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#39A900' }}>
        <Printer size={18} />
        {busy ? 'Preparing...' : 'Generate & Share Bill'}
      </button>

      {showPreview && patient && billNo && (
        <BillPreview
          patient={patient} billNo={billNo} diagnosis={diagnosis}
          rows={rows} total={total}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

function BillPreview({ patient, billNo, diagnosis, rows, total, onClose }: {
  patient: Patient; billNo: number; diagnosis: string
  rows: ChargeRow[]; total: number; onClose: () => void
}) {
  const today       = format(new Date(), 'dd-MM-yyyy')
  const joiningDate = patient.created_at ? format(parseISO(patient.created_at), 'dd-MM-yyyy') : '—'

  const cellStyle: React.CSSProperties = {
    border: '1px solid #333', padding: '5px 8px', textAlign: 'center',
  }
  const cellLeft: React.CSSProperties = {
    ...cellStyle, textAlign: 'left', fontWeight: 'bold',
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .bill-printable, .bill-printable * { visibility: visible !important; }
          .bill-printable {
            position: fixed !important; top: 0; left: 0;
            width: 100%; padding: 28px; background: white;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#e5e7eb' }}>
        {/* Top action bar */}
        <div className="bill-no-print flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-600">
            <X size={18} /> Close
          </button>
          <span className="text-sm font-semibold text-gray-700">Bill #{billNo}</span>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#39A900' }}>
            <Printer size={15} /> Share / Print
          </button>
        </div>

        {/* Scrollable bill paper */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bill-printable bg-white shadow-md mx-auto p-8"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#000', lineHeight: '1.7', maxWidth: '680px' }}>

            {/* Bill No + Date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span><strong>Bill No.:-</strong>&nbsp;&nbsp;{billNo}</span>
              <span><strong>Date:-</strong>&nbsp;&nbsp;{today}</span>
            </div>

            {/* Title */}
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', fontSize: '17px', marginBottom: '18px' }}>
              (Physiotherapy Division)
            </h2>

            {/* Patient info block */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px' }}>
              <tbody>
                {([
                  ['Name',         patient.name],
                  ['Age/Sex',      `${patient.age} Yrs / ${patient.gender}`],
                  ['Ref. by',      patient.referred_by || 'Self'],
                  ['Diagnosis',    diagnosis || '—'],
                  ['Joining Date', joiningDate],
                ] as [string, string][]).map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ width: '120px', fontWeight: 'bold', paddingBottom: '3px' }}>{label}</td>
                    <td style={{ width: '14px', paddingBottom: '3px' }}>:-</td>
                    <td style={{ paddingBottom: '3px' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Charges table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
              <thead>
                <tr>
                  <th style={{ ...cellLeft, width: '38%', borderBottom: '2px solid #333' }}></th>
                  <th style={{ ...cellStyle, borderBottom: '2px solid #333' }}>1) Charge /<br />Day</th>
                  <th style={{ ...cellStyle, borderBottom: '2px solid #333' }}>2) No. of<br />Days</th>
                  <th style={{ ...cellStyle, borderBottom: '2px solid #333' }}>3) Visits /<br />day</th>
                  <th style={{ ...cellStyle, fontWeight: 'bold', borderBottom: '2px solid #333' }}>Amount<br />Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const amt = rowAmt(row)
                  return (
                    <tr key={i}>
                      <td style={cellLeft}>{row.label}</td>
                      <td style={cellStyle}>{row.chargePerDay || 0}</td>
                      <td style={cellStyle}>{row.days || 0}</td>
                      <td style={cellStyle}>{row.visitsPerDay || 0}</td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{amt || 0}</td>
                    </tr>
                  )
                })}
                {/* spacer row */}
                <tr>
                  <td colSpan={4} style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333', paddingTop: '8px' }}>
                    Total
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                    {total}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words */}
            <p style={{ marginBottom: '48px' }}>
              <strong>Amount In Words:-</strong>&nbsp;&nbsp;{toWords(total)}
            </p>

            {/* Seal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '88px', height: '88px', borderRadius: '50%',
                  border: '2px solid #333',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', fontSize: '11px',
                }}>
                  <span>Reg. No.</span>
                  <span style={{ fontWeight: 'bold' }}>GPC6583</span>
                </div>
                <p style={{ marginTop: '8px', fontSize: '12px' }}>Seal of Centre &amp;</p>
                <p style={{ fontSize: '12px' }}>Signature Of Doctor</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
