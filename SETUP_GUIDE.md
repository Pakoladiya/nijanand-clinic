# NFC Clinic App — Setup Guide
## One-time setup. Takes about 30 minutes.

---

## STEP 1 — Create Supabase Project (Free)

1. Go to https://supabase.com → Sign up (free)
2. Click "New Project"
   - Name: `nijanand-clinic`
   - Password: (save this)
   - Region: `Southeast Asia (Singapore)` — closest to India
3. Wait 2 minutes for project to be ready

4. Go to **SQL Editor** → paste entire contents of:
   `supabase/migrations/001_initial_schema.sql`
   → Click **Run**

5. Create Storage Bucket:
   - Go to **Storage** → New Bucket
   - Name: `patient-photos`
   - Public bucket: YES
   - Click Create

6. Get your keys:
   - Go to **Settings → API**
   - Copy `Project URL` → paste in `.env` as `VITE_SUPABASE_URL`
   - Copy `anon public` key → paste in `.env` as `VITE_SUPABASE_ANON_KEY`

---

## STEP 2 — Set Initial Staff Passwords

In Supabase **SQL Editor**, run this to set passwords:
(Replace passwords as needed. Default password shown: NFC@2026)

```sql
-- SHA-256 of "NFC@2026"
-- Generate hashes at: https://emn178.github.io/online-tools/sha256.html

UPDATE staff SET password_hash = '<hash_of_your_password>'
WHERE username IN ('piyush', 'aruna', 'divyaxi', 'shreya', 'clinic');
```

**Easy way**: After app is running, use Admin Dashboard → Edit Staff → set new password.

---

## STEP 3 — Deploy to Vercel (Free)

1. Go to https://vercel.com → Sign up with GitHub
2. Upload this project folder to GitHub (or use Vercel CLI)
3. Import project in Vercel
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Deploy → Vercel gives you a URL like `nijanand-clinic.vercel.app`

---

## STEP 4 — Connect nijanandfit.in Domain

1. In Vercel → Project → Settings → Domains
2. Add `nijanandfit.in`
3. Vercel will show you DNS records to add

4. Go to your domain registrar (where you bought nijanandfit.in)
5. Add the DNS records Vercel shows you
6. Wait 10-30 minutes → your app runs at `nijanandfit.in`

---

## STEP 5 — Set Up Daily 9 PM Email

### 5a. Create Resend Account (Free)
1. Go to https://resend.com → Sign up
2. Add domain: `nijanandfit.in`
3. Follow DNS verification steps
4. Create API Key → copy it

### 5b. Deploy Edge Function
1. Install Supabase CLI: `npm install -g supabase`
2. Run: `supabase login`
3. Run: `supabase functions deploy daily-report`
4. Set secrets:
```
supabase secrets set RESEND_API_KEY=your_resend_key
```

### 5c. Schedule at 9 PM IST
1. In Supabase → **Database → Extensions** → Enable `pg_cron`
2. In SQL Editor run:
```sql
SELECT cron.schedule(
  'daily-report-9pm',
  '30 15 * * *',  -- 15:30 UTC = 9:00 PM IST
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/daily-report',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## STEP 6 — Register Your 5 Devices

On each device:
1. Open `nijanandfit.in` in Chrome/Safari
2. "Device Not Authorised" screen appears
3. Enter device name (e.g. "Dr. Piyush Mobile")
4. Enter admin password
5. Device is registered ✅

---

## Staff Login Details

| Name | Username | Default Password |
|------|----------|-----------------|
| Dr. Piyush Koladiya (Admin) | piyush | Set in Step 2 |
| Dr. Aruna Koladiya | aruna | Set in Step 2 |
| Dr. Divyaxi | divyaxi | Set in Step 2 |
| Dr. Shreya | shreya | Set in Step 2 |
| Clinic Mobile | clinic | Set in Step 2 |

---

## Running Locally (for testing)

```bash
cd nijanand-clinic
cp .env.example .env
# Fill in your Supabase keys in .env
npm install
npm run dev
# Opens at http://localhost:5173
```
