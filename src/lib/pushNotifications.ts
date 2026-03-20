/**
 * Push Notification helpers
 *
 * subscribeToPush  — registers the SW, asks permission, saves subscription to DB
 * sendQueuePush    — fetches admin subscriptions and calls the edge function
 */

import { supabase } from './supabase'

// Set in .env as VITE_VAPID_PUBLIC_KEY=<your public key>
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

/** Convert the base64url VAPID public key to the Uint8Array that the browser needs */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out as Uint8Array<ArrayBuffer>
}

/**
 * Register the service worker + request push permission.
 * Saves the browser's PushSubscription to the push_subscriptions table.
 * Safe to call multiple times — upserts by endpoint.
 */
export async function subscribeToPush(staffId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set — skipping')
    return
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // Save to Supabase — upsert so re-registering the same device is idempotent
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { staff_id: staffId, endpoint: sub.endpoint, subscription: sub.toJSON() },
        { onConflict: 'endpoint' }
      )

    if (error) console.error('[Push] Failed to save subscription:', error.message)
    else console.log('[Push] Subscribed and saved.')

  } catch (err) {
    console.error('[Push] Subscribe failed:', err)
  }
}

/**
 * Fetch all admin push subscriptions from Supabase and
 * fire the send-push edge function.  Errors are silent so
 * a notification failure never breaks the queue flow.
 */
export async function sendQueuePush(patientName: string, session: string): Promise<void> {
  try {
    // 1. Get all admin staff IDs
    const { data: admins } = await supabase
      .from('staff')
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const adminIds = new Set(admins.map((a: any) => a.id as string))

    // 2. Get push subscriptions that belong to admins
    const { data: rows } = await supabase
      .from('push_subscriptions')
      .select('staff_id, subscription')

    if (!rows || rows.length === 0) return

    const adminSubs = rows
      .filter((r: any) => adminIds.has(r.staff_id))
      .map((r: any) => r.subscription)

    if (adminSubs.length === 0) return

    // 3. Invoke the edge function — fire and forget
    await supabase.functions.invoke('send-push', {
      body: {
        title: '🏥 Patient Added to Queue',
        body:  `${patientName} added to ${session} queue`,
        subscriptions: adminSubs,
      },
    })

  } catch (err) {
    // Never let a push failure surface to the user
    console.error('[Push] sendQueuePush failed:', err)
  }
}
