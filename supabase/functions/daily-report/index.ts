// Supabase Edge Function — runs daily at 9 PM IST (15:30 UTC)
// Schedule: "30 15 * * *" in Supabase dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'Pakoladiya@gmail.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  // Get today's attendance
  const { data: morningAtt } = await supabase
    .from('attendance')
    .select('*, patients(name, registration_number)')
    .eq('date', today).eq('session', 'morning')
    .order('created_at')

  const { data: eveningAtt } = await supabase
    .from('attendance')
    .select('*, patients(name, registration_number)')
    .eq('date', today).eq('session', 'evening')
    .order('created_at')

  // Today's financials
  const { data: todayPayments } = await supabase
    .from('payments').select('amount').eq('date', today)

  const { data: todayExpenses } = await supabase
    .from('expenses').select('amount').eq('date', today)

  // Month totals
  const { data: monthPayments } = await supabase
    .from('payments').select('amount').gte('date', monthStart).lte('date', today)

  const { data: monthExpenses } = await supabase
    .from('expenses').select('amount').gte('date', monthStart).lte('date', today)

  const todayIncome = (todayPayments || []).reduce((s: number, p: any) => s + p.amount, 0)
  const todayExp = (todayExpenses || []).reduce((s: number, e: any) => s + e.amount, 0)
  const monthIncome = (monthPayments || []).reduce((s: number, p: any) => s + p.amount, 0)
  const monthExp = (monthExpenses || []).reduce((s: number, e: any) => s + e.amount, 0)

  const morning = morningAtt || []
  const evening = eveningAtt || []

  const formatList = (list: any[]) =>
    list.map((a, i) => `${i + 1}. ${(a.patients as any)?.name} — ${(a.patients as any)?.registration_number} (Visit #${a.visit_number})`).join('<br>') || 'No patients'

  const dateFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 16px;">
    <div style="background: linear-gradient(135deg, #F6A000, #e09000); padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
      <h2 style="color: white; margin: 0; font-size: 20px;">Nijanand Fitness Centre</h2>
      <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">Daily Report — ${dateFormatted}</p>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <h3 style="color: #374151; margin: 0 0 12px; font-size: 16px;">☀️ Morning Session (${morning.length} patients)</h3>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0;">${formatList(morning)}</p>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <h3 style="color: #374151; margin: 0 0 12px; font-size: 16px;">🌙 Evening Session (${evening.length} patients)</h3>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0;">${formatList(evening)}</p>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <h3 style="color: #374151; margin: 0 0 16px; font-size: 16px;">💰 Today's Financials</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Total Patients</td><td style="text-align: right; font-weight: bold;">${morning.length + evening.length}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Fees Collected</td><td style="text-align: right; font-weight: bold; color: #39A900;">₹${todayIncome.toLocaleString('en-IN')}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Expenses</td><td style="text-align: right; font-weight: bold; color: #ef4444;">₹${todayExp.toLocaleString('en-IN')}</td></tr>
        <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; font-weight: bold;">Net Income</td><td style="text-align: right; font-weight: bold; color: ${(todayIncome - todayExp) >= 0 ? '#39A900' : '#ef4444'};">₹${(todayIncome - todayExp).toLocaleString('en-IN')}</td></tr>
      </table>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px;">
      <h3 style="color: #374151; margin: 0 0 16px; font-size: 16px;">📊 Monthly Running Total</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Total Income</td><td style="text-align: right; font-weight: bold; color: #39A900;">₹${monthIncome.toLocaleString('en-IN')}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Total Expenses</td><td style="text-align: right; font-weight: bold; color: #ef4444;">₹${monthExp.toLocaleString('en-IN')}</td></tr>
        <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; font-weight: bold;">Net Income</td><td style="text-align: right; font-weight: bold; color: ${(monthIncome - monthExp) >= 0 ? '#39A900' : '#ef4444'};">₹${(monthIncome - monthExp).toLocaleString('en-IN')}</td></tr>
      </table>
    </div>

    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
      Nijanand Fitness Centre • 📞 63551 08454 • Movement is Medicine
    </p>
  </div>`

  // Send via Resend
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'NFC Reports <reports@nijanandfit.in>',
      to: ADMIN_EMAIL,
      subject: `NFC Daily Report — ${dateFormatted}`,
      html
    })
  })

  return new Response(JSON.stringify({ success: true, date: today }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
