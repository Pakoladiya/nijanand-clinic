import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { Search, Printer, X, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
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

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400'

export default function BillingPage() {
  const [search, setSearch]           = useState('')
  const [suggestions, setSuggestions] = useState<Patient[]>([])
  const [patient, setPatient]         = useState<Patient | null>(null)

  // Editable bill fields — auto-filled from patient, staff can change before generating
  const [billDate, setBillDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [name, setName]               = useState('')
  const [age, setAge]                 = useState('')
  const [gender, setGender]           = useState('Male')
  const [refBy, setRefBy]             = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [diagnosis, setDiagnosis]     = useState('')

  const [rows, setRows] = useState<ChargeRow[]>([
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

  function selectPatient(p: Patient) {
    setPatient(p)
    setName(p.name)
    setAge(String(p.age))
    setGender(p.gender)
    setRefBy(p.referred_by || 'Self')
    setJoiningDate(p.created_at ? format(parseISO(p.created_at), 'yyyy-MM-dd') : '')
    setSuggestions([])
    setSearch('')
  }

  function clearPatient() {
    setPatient(null)
    setName(''); setAge(''); setGender('Male')
    setRefBy(''); setJoiningDate(''); setDiagnosis('')
  }

  async function handleGenerate() {
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

  // Format date for display on bill (dd-MM-yyyy)
  function fmtDate(val: string) {
    try { return val ? format(parseISO(val), 'dd-MM-yyyy') : '—' } catch { return val }
  }

  return (
    <div className="space-y-3">
      {/* Patient search */}
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
                    onMouseDown={() => selectPatient(p)}
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
            <p className="text-sm font-semibold text-gray-800">{patient.name}
              <span className="text-xs font-normal text-gray-500 ml-2">{patient.registration_number}</span>
            </p>
            <button onClick={clearPatient} className="text-gray-400 p-1"><X size={15} /></button>
          </div>
        )}
      </div>

      {/* Bill details — all editable */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
        <p className="text-sm font-semibold text-gray-700 mb-1">Bill Details</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Bill Date</p>
            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className={inp} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Joining Date</p>
            <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className={inp} />
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Patient Name</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Patient name" className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Age</p>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Age" className={inp} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Gender</p>
            <select value={gender} onChange={e => setGender(e.target.value)} className={inp}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Referred By</p>
          <input value={refBy} onChange={e => setRefBy(e.target.value)} placeholder="Self" className={inp} />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Diagnosis</p>
          <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnosis" className={inp} />
        </div>
      </div>

      {/* Charges */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Charges</p>
        <div className="grid grid-cols-4 gap-1 mb-2">
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

      <button onClick={handleGenerate} disabled={!name || busy}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#39A900' }}>
        <Printer size={18} />
        {busy ? 'Preparing...' : 'Generate & Share Bill'}
      </button>

      {showPreview && billNo && (
        <BillPreview
          billNo={billNo}
          billDate={fmtDate(billDate)}
          name={name} age={age} gender={gender}
          refBy={refBy} joiningDate={fmtDate(joiningDate)}
          diagnosis={diagnosis}
          rows={rows} total={total}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

function BillPreview({ billNo, billDate, name, age, gender, refBy, joiningDate, diagnosis, rows, total, onClose }: {
  billNo: number; billDate: string
  name: string; age: string; gender: string
  refBy: string; joiningDate: string; diagnosis: string
  rows: ChargeRow[]; total: number
  onClose: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const cell: React.CSSProperties = { border: '1px solid #333', padding: '5px 8px', textAlign: 'center' }
  const cellL: React.CSSProperties = { ...cell, textAlign: 'left', fontWeight: 'bold' }

  async function handleShare() {
    const billEl = document.getElementById('bill-content') as HTMLElement
    if (!billEl) return
    setSharing(true)
    try {
      // A4 at 96dpi = 794×1123px; scale:2 doubles resolution for sharpness
      const A4_W = 794, A4_H = 1123
      const canvas = await html2canvas(billEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: A4_W,
        height: A4_H,
        windowWidth: A4_W,
        windowHeight: A4_H,
      })
      canvas.toBlob(async (blob) => {
        if (!blob) { setSharing(false); return }
        const file = new File([blob], `Bill-${billNo}.png`, { type: 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `Bill #${billNo} - Nijanand Fitness Centre`, files: [file] })
        } else {
          // Fallback: download as image
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Bill-${billNo}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
        setSharing(false)
      }, 'image/png')
    } catch (err) {
      console.error('Share failed:', err)
      setSharing(false)
    }
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          #bill-overlay {
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            background: white !important;
            overflow: hidden !important;
          }
          #bill-scroll {
            visibility: visible !important;
            overflow: visible !important;
            padding: 0 !important;
            display: block !important;
            width: 210mm !important;
            height: 297mm !important;
          }
          .bill-no-print { display: none !important; }
          .bill-printable {
            visibility: visible !important;
            box-shadow: none !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
          }
          .bill-printable * { visibility: visible !important; }
        }
      `}</style>

      <div id="bill-overlay" className="fixed inset-0 z-50 flex flex-col" style={{ background: '#d1d5db' }}>
        {/* Action bar */}
        <div className="bill-no-print flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-600">
            <X size={18} /> Close
          </button>
          <span className="text-sm font-semibold text-gray-700">Bill #{billNo}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleShare} disabled={sharing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: '#25D366' }}>
              <Share2 size={15} /> {sharing ? 'Sharing...' : 'Share'}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#39A900' }}>
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        {/* Scrollable A4 preview */}
        <div id="bill-scroll" className="flex-1 overflow-y-auto py-6 px-4 flex justify-center">
          <div id="bill-content" className="bill-printable bg-white shadow-xl"
            style={{
              width: '210mm',
              height: '297mm',
              paddingTop: '2in',
              paddingLeft: '14mm',
              paddingRight: '14mm',
              paddingBottom: '14mm',
              boxSizing: 'border-box',
              fontFamily: 'Arial, sans-serif',
              fontSize: '13px',
              color: '#000',
              lineHeight: '1.6',
              overflow: 'hidden',
            }}>

            {/* Bill No + Date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span><strong>Bill No.:-</strong>&nbsp;&nbsp;{billNo}</span>
              <span><strong>Date:-</strong>&nbsp;&nbsp;{billDate}</span>
            </div>

            {/* Title */}
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', fontSize: '16px', marginBottom: '16px' }}>
              (Physiotherapy Division)
            </h2>

            {/* Patient info */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <tbody>
                {([
                  ['Name',         name],
                  ['Age/Sex',      `${age} Yrs / ${gender}`],
                  ['Ref. by',      refBy || 'Self'],
                  ['Diagnosis',    diagnosis || '—'],
                  ['Joining Date', joiningDate],
                ] as [string, string][]).map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ width: '110px', fontWeight: 'bold', paddingBottom: '3px' }}>{label}</td>
                    <td style={{ width: '14px', paddingBottom: '3px' }}>:-</td>
                    <td style={{ paddingBottom: '3px' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Charges table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th style={{ ...cellL, width: '40%', borderBottom: '2px solid #333', fontWeight: 'normal' }}></th>
                  <th style={{ ...cell, borderBottom: '2px solid #333' }}>1) Charge /<br />Day</th>
                  <th style={{ ...cell, borderBottom: '2px solid #333' }}>2) No. of<br />Days</th>
                  <th style={{ ...cell, borderBottom: '2px solid #333' }}>3) Visits /<br />day</th>
                  <th style={{ ...cell, fontWeight: 'bold', borderBottom: '2px solid #333' }}>Amount<br />Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td style={cellL}>{row.label}</td>
                    <td style={cell}>{row.chargePerDay || 0}</td>
                    <td style={cell}>{row.days || 0}</td>
                    <td style={cell}>{row.visitsPerDay || 0}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{rowAmt(row) || 0}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ ...cell, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                    Total
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                    {total}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words */}
            <p style={{ marginBottom: '44px' }}>
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
