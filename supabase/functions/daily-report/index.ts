// Supabase Edge Function — Daily 9 PM IST Report
// Triggered by cron-job.org at 15:30 UTC (= 21:00 IST) every day

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL   = 'pakoladiya@gmail.com'
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET        = Deno.env.get('CRON_SECRET') || ''

Deno.serve(async (req: Request) => {
  // Optional secret check — cron-job.org sends ?secret=XXX in URL
  if (CRON_SECRET) {
    const url = new URL(req.url)
    if (url.searchParams.get('secret') !== CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // ── Compute today's date in IST (UTC+5:30) ──
  const nowUtc    = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000           // 5h 30m in ms
  const nowIst    = new Date(nowUtc.getTime() + istOffset)
  const today     = nowIst.toISOString().split('T')[0]          // YYYY-MM-DD
  const monthStart = today.slice(0, 8) + '01'                   // first day of month

  // ── Fetch attendance with patient details ──
  const [{ data: morningAtt }, { data: eveningAtt }] = await Promise.all([
    supabase
      .from('attendance')
      .select('visit_number, patients(name, registration_number)')
      .eq('date', today)
      .eq('session', 'morning')
      .order('created_at'),
    supabase
      .from('attendance')
      .select('visit_number, patients(name, registration_number)')
      .eq('date', today)
      .eq('session', 'evening')
      .order('created_at'),
  ])

  // ── Today's payments with detail ──
  const { data: todayPayments } = await supabase
    .from('payments')
    .select('amount, payment_type, notes, patients(name)')
    .eq('date', today)
    .order('created_at')

  // ── Today's expenses ──
  const { data: todayExpenses } = await supabase
    .from('expenses')
    .select('amount, category, description')
    .eq('date', today)
    .order('created_at')

  // ── Today's new registrations ──
  const { count: newPatients } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00+05:30`)
    .lte('created_at', `${today}T23:59:59+05:30`)

  // ── Month running totals ──
  const [{ data: monthPayments }, { data: monthExpenses }] = await Promise.all([
    supabase.from('payments').select('amount').gte('date', monthStart).lte('date', today),
    supabase.from('expenses').select('amount').gte('date', monthStart).lte('date', today),
  ])

  // ── Compute sums ──
  const todayIncome  = (todayPayments  || []).reduce((s: number, p: any) => s + p.amount, 0)
  const todayExp     = (todayExpenses  || []).reduce((s: number, e: any) => s + e.amount, 0)
  const monthIncome  = (monthPayments  || []).reduce((s: number, p: any) => s + p.amount, 0)
  const monthExp     = (monthExpenses  || []).reduce((s: number, e: any) => s + e.amount, 0)
  const morning      = morningAtt || []
  const evening      = eveningAtt || []
  const totalOPD     = morning.length + evening.length

  // ── Payment type breakdown ──
  const payByType: Record<string, number> = {}
  for (const p of (todayPayments || [])) {
    payByType[p.payment_type] = (payByType[p.payment_type] || 0) + p.amount
  }
  const payTypeLabel: Record<string, string> = {
    per_session:      'Per-session fees',
    package:          'Package payments',
    advance:          'Advance payments',
    registration_fee: 'Registration fees',
  }

  // ── Date string for subject / header ──
  const dateFormatted = nowIst.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Kolkata',
  })

  // ── Helper: attendance list rows ──
  const attRows = (list: any[]) =>
    list.length === 0
      ? `<tr><td colspan="3" style="color:#9ca3af;font-size:13px;padding:8px 0;">— No patients —</td></tr>`
      : list.map((a: any, i: number) => `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 0;font-size:13px;color:#374151;">${i + 1}.</td>
            <td style="padding:5px 6px;font-size:13px;color:#111827;font-weight:600;">${(a.patients as any)?.name ?? '—'}</td>
            <td style="padding:5px 0;font-size:12px;color:#6b7280;">${(a.patients as any)?.registration_number ?? ''} &nbsp;|&nbsp; Visit #${a.visit_number}</td>
          </tr>`).join('')

  // ── Helper: payment detail rows ──
  const payRows = (todayPayments || []).length === 0
    ? `<tr><td colspan="3" style="color:#9ca3af;font-size:13px;padding:8px 0;">— No payments —</td></tr>`
    : (todayPayments || []).map((p: any) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:5px 0;font-size:13px;color:#111827;">${(p.patients as any)?.name ?? '—'}</td>
          <td style="padding:5px 6px;font-size:12px;color:#6b7280;">${payTypeLabel[p.payment_type] ?? p.payment_type}</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:#39A900;text-align:right;">₹${p.amount.toLocaleString('en-IN')}</td>
        </tr>`).join('')

  // ── Helper: expense detail rows ──
  const expRows = (todayExpenses || []).length === 0
    ? `<tr><td colspan="3" style="color:#9ca3af;font-size:13px;padding:8px 0;">— No expenses —</td></tr>`
    : (todayExpenses || []).map((e: any) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:5px 0;font-size:12px;color:#6b7280;">${e.category}</td>
          <td style="padding:5px 6px;font-size:13px;color:#111827;">${e.description}</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:#ef4444;text-align:right;">₹${e.amount.toLocaleString('en-IN')}</td>
        </tr>`).join('')

  // ── Payment breakdown rows ──
  const breakdownRows = Object.entries(payByType).map(([type, amt]) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">${payTypeLabel[type] ?? type}</td>
      <td style="padding:4px 0;font-size:13px;font-weight:600;color:#39A900;text-align:right;">₹${(amt as number).toLocaleString('en-IN')}</td>
    </tr>`).join('')

  // ── Net colours ──
  const todayNetColor = (todayIncome - todayExp) >= 0 ? '#39A900' : '#ef4444'
  const monthNetColor = (monthIncome - monthExp) >= 0 ? '#39A900' : '#ef4444'

  // ── Build HTML email ──
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:24px auto;padding:0 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#F6A000,#e08800);border-radius:14px 14px 0 0;padding:22px 24px;">
    <h2 style="color:white;margin:0;font-size:22px;font-weight:800;">Nijanand Fitness Centre</h2>
    <p style="color:rgba(255,255,255,0.88);margin:5px 0 0;font-size:14px;">📋 Daily Summary — ${dateFormatted}</p>
  </div>

  <!-- OPD Summary strip -->
  <div style="background:#1f2937;padding:14px 24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div style="text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">Total OPD</p>
      <p style="color:white;font-size:26px;font-weight:800;margin:2px 0 0;">${totalOPD}</p>
    </div>
    <div style="text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">☀️ Morning</p>
      <p style="color:#F6A000;font-size:26px;font-weight:800;margin:2px 0 0;">${morning.length}</p>
    </div>
    <div style="text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">🌙 Evening</p>
      <p style="color:#60a5fa;font-size:26px;font-weight:800;margin:2px 0 0;">${evening.length}</p>
    </div>
    <div style="text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">New Patients</p>
      <p style="color:#34d399;font-size:26px;font-weight:800;margin:2px 0 0;">${newPatients ?? 0}</p>
    </div>
  </div>

  <!-- Morning patients -->
  <div style="background:white;padding:20px 24px;border-top:3px solid #F6A000;margin-top:2px;border-radius:0;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">☀️ Morning Session &nbsp;<span style="font-weight:400;color:#9ca3af;">(${morning.length} patients)</span></h3>
    <table style="width:100%;border-collapse:collapse;">
      ${attRows(morning)}
    </table>
  </div>

  <!-- Evening patients -->
  <div style="background:white;padding:20px 24px;border-top:3px solid #3b82f6;margin-top:2px;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">🌙 Evening Session &nbsp;<span style="font-weight:400;color:#9ca3af;">(${evening.length} patients)</span></h3>
    <table style="width:100%;border-collapse:collapse;">
      ${attRows(evening)}
    </table>
  </div>

  <!-- Today financials summary -->
  <div style="background:white;padding:20px 24px;border-top:3px solid #39A900;margin-top:2px;">
    <h3 style="margin:0 0 14px;font-size:15px;color:#374151;">💰 Today's Financials</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Fees Collected</td>
        <td style="padding:6px 0;font-size:15px;font-weight:700;color:#39A900;text-align:right;">₹${todayIncome.toLocaleString('en-IN')}</td>
      </tr>
      ${breakdownRows}
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Expenses</td>
        <td style="padding:6px 0;font-size:15px;font-weight:700;color:#ef4444;text-align:right;">₹${todayExp.toLocaleString('en-IN')}</td>
      </tr>
      <tr style="border-top:2px solid #f3f4f6;">
        <td style="padding:10px 0;font-size:14px;font-weight:700;color:#111827;">Net Income</td>
        <td style="padding:10px 0;font-size:18px;font-weight:800;color:${todayNetColor};text-align:right;">₹${(todayIncome - todayExp).toLocaleString('en-IN')}</td>
      </tr>
    </table>
  </div>

  <!-- Payment detail -->
  <div style="background:white;padding:20px 24px;border-top:1px solid #f3f4f6;margin-top:2px;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">📄 Payment Detail</h3>
    <table style="width:100%;border-collapse:collapse;">
      ${payRows}
    </table>
  </div>

  <!-- Expense detail -->
  <div style="background:white;padding:20px 24px;border-top:1px solid #f3f4f6;margin-top:2px;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">🧾 Expense Detail</h3>
    <table style="width:100%;border-collapse:collapse;">
      ${expRows}
    </table>
  </div>

  <!-- Month totals -->
  <div style="background:#f0fdf4;padding:20px 24px;border:2px solid #86efac;border-radius:0 0 14px 14px;margin-top:2px;">
    <h3 style="margin:0 0 14px;font-size:15px;color:#374151;">📊 ${nowIst.toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'})} Running Total</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Total Income</td>
        <td style="padding:6px 0;font-size:15px;font-weight:700;color:#39A900;text-align:right;">₹${monthIncome.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Total Expenses</td>
        <td style="padding:6px 0;font-size:15px;font-weight:700;color:#ef4444;text-align:right;">₹${monthExp.toLocaleString('en-IN')}</td>
      </tr>
      <tr style="border-top:2px solid #d1fae5;">
        <td style="padding:10px 0;font-size:14px;font-weight:700;color:#111827;">Net Income</td>
        <td style="padding:10px 0;font-size:18px;font-weight:800;color:${monthNetColor};text-align:right;">₹${(monthIncome - monthExp).toLocaleString('en-IN')}</td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin:16px 0 24px;">
    Nijanand Fitness Centre &nbsp;•&nbsp; 241, Royal Arcade, Sarthana Jakatnaka, Surat &nbsp;•&nbsp; 📞 63551 08454
  </p>

</div>
</body>
</html>`

  // ── Send via Resend ──
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nijanand Clinic <reports@nijanandfit.in>',
      to:   [ADMIN_EMAIL],
      subject: `NFC Daily Report — ${dateFormatted}`,
      html,
    }),
  })

  const resendBody = await resendRes.json()

  return new Response(
    JSON.stringify({ success: resendRes.ok, date: today, resend: resendBody }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
