import { useRef, useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import { Download, X, Share2 } from 'lucide-react'
import type { Patient } from '../types'

interface Props { patient: Patient; onClose: () => void }

export default function WelcomeImageModal({ patient, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)

  // Pre-fetch patient photo as base64 so html2canvas can embed it (avoids CORS blank image)
  useEffect(() => {
    if (!patient.photo_url) return
    fetch(patient.photo_url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => setPhotoBase64(reader.result as string)
        reader.readAsDataURL(blob)
      })
      .catch(() => setPhotoBase64(null))
  }, [patient.photo_url])

  async function downloadImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      scale: 2, useCORS: true, backgroundColor: null, allowTaint: true,
    })
    const link = document.createElement('a')
    link.download = `NijAadhaar-${patient.registration_number}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
  }

  async function shareImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      scale: 2, useCORS: true, backgroundColor: null, allowTaint: true,
    })
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `NijAadhaar-${patient.registration_number}.jpg`, { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'નિજ-આધાર કાર્ડ' })
      } else {
        downloadImage()
      }
    }, 'image/jpeg', 0.95)
  }

  const gujFont = "'Anek Gujarati', Arial, sans-serif"
  const issueDate = new Date(patient.created_at)
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const genderGuj = patient.gender === 'Male' ? 'પુરૂષ' : patient.gender === 'Female' ? 'સ્ત્રી' : 'અન્ય'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">નિજ-આધાર કાર્ડ તૈયાર છે</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-4 bg-gray-100">
          <div ref={cardRef} style={{
            fontFamily: gujFont,
            borderRadius: 10,
            overflow: 'hidden',
            border: '1.5px solid #d1d5db',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: 'white',
          }}>

            {/* ── Orange Header (like Aadhaar saffron top) ── */}
            <div style={{
              background: 'linear-gradient(135deg, #F6A000 0%, #e08800 100%)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              {/* Left: Logo + Clinic name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/logo.png" alt="Logo" crossOrigin="anonymous"
                  style={{ width: 38, height: 38, borderRadius: '50%', background: 'white',
                    objectFit: 'cover', padding: 2, flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.6)' }} />
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: 13, margin: 0,
                    fontFamily: gujFont, lineHeight: 1.2 }}>
                    નિજાનંદ ફિટનેસ સેન્ટર
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, margin: 0,
                    fontFamily: "'Arial', sans-serif", letterSpacing: '0.3px' }}>
                    Nijanand Fitness Centre
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 8, margin: '2px 0 0 0',
                    fontFamily: gujFont, lineHeight: 1.3 }}>
                    ૨૪૧, રોયલ આર્કેડ, સરથાણા જકાતનાકા, સુરત
                  </p>
                </div>
              </div>

              {/* Right: Nij-Aadhaar branding */}
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'white', fontWeight: 'bold', fontSize: 18, margin: 0,
                  fontFamily: gujFont, lineHeight: 1.1 }}>
                  નિજ-આધાર
                </p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, margin: 0,
                  fontFamily: "'Arial', sans-serif", letterSpacing: '1.5px', fontWeight: '600' }}>
                  NIJ-AADHAAR
                </p>
              </div>
            </div>

            {/* ── White Card Body ── */}
            <div style={{ display: 'flex', padding: '12px 14px', gap: 12,
              background: 'linear-gradient(160deg, #fffdf8 0%, #f8fff4 100%)' }}>

              {/* Left column: Photo */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                {photoBase64 ? (
                  <img src={photoBase64} alt={patient.name}
                    style={{ width: 76, height: 90, objectFit: 'cover', borderRadius: 8,
                      border: '2.5px solid #F6A000',
                      boxShadow: '0 2px 8px rgba(246,160,0,0.3)' }} />
                ) : patient.photo_url ? (
                  /* Photo loading — show placeholder */
                  <div style={{ width: 76, height: 90, borderRadius: 8,
                    background: '#FEF3C7', border: '2.5px solid #F6A000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#F6A000', fontSize: 10, fontFamily: gujFont, textAlign: 'center',
                    padding: 4 }}>
                    ફોટો લોડ...
                  </div>
                ) : (
                  <div style={{ width: 76, height: 90, borderRadius: 8,
                    background: 'linear-gradient(135deg, #F6A000, #e08800)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2.5px solid #F6A000', color: 'white', fontWeight: 'bold',
                    fontSize: 30, fontFamily: gujFont,
                    boxShadow: '0 2px 8px rgba(246,160,0,0.3)' }}>
                    {patient.name[0].toUpperCase()}
                  </div>
                )}
                {/* Small decorative dots like Aadhaar pattern */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%',
                      background: i % 2 === 0 ? '#F6A000' : '#39A900' }} />
                  ))}
                </div>
              </div>

              {/* Right column: Patient details */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Name — English big, Gujarati small gray below */}
                <div style={{ marginBottom: 7, borderBottom: '1px solid #f3f4f6', paddingBottom: 6 }}>
                  <p style={{ color: '#111827', fontWeight: 'bold', fontSize: 17, margin: '0 0 1px 0',
                    fontFamily: "'Arial', sans-serif", lineHeight: 1.2 }}>
                    {patient.name}
                  </p>
                  {patient.name_gujarati && (
                    <p style={{ color: '#9ca3af', fontSize: 11, margin: 0, fontFamily: gujFont }}>
                      {patient.name_gujarati}
                    </p>
                  )}
                </div>

                {/* Age / Gender / Date row */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div>
                    <p style={{ color: '#9ca3af', fontSize: 8, margin: '0 0 1px 0', fontFamily: gujFont,
                      textTransform: 'uppercase', letterSpacing: '0.3px' }}>ઉંમર</p>
                    <p style={{ color: '#1f2937', fontSize: 13, fontWeight: '700', margin: 0,
                      fontFamily: gujFont }}>
                      {patient.age} વર્ષ
                    </p>
                  </div>
                  <div style={{ width: 1, background: '#e5e7eb' }} />
                  <div>
                    <p style={{ color: '#9ca3af', fontSize: 8, margin: '0 0 1px 0', fontFamily: gujFont,
                      textTransform: 'uppercase', letterSpacing: '0.3px' }}>જાતિ</p>
                    <p style={{ color: '#1f2937', fontSize: 13, fontWeight: '700', margin: 0,
                      fontFamily: gujFont }}>
                      {genderGuj}
                    </p>
                  </div>
                  <div style={{ width: 1, background: '#e5e7eb' }} />
                  <div>
                    <p style={{ color: '#9ca3af', fontSize: 8, margin: '0 0 1px 0', fontFamily: gujFont,
                      textTransform: 'uppercase', letterSpacing: '0.3px' }}>નોંધ તા.</p>
                    <p style={{ color: '#1f2937', fontSize: 11, fontWeight: '700', margin: 0,
                      fontFamily: "'Arial', sans-serif" }}>
                      {issueDate}
                    </p>
                  </div>
                </div>

                {/* Registration Number — big like Aadhaar's 12-digit */}
                <div style={{ background: 'white', borderRadius: 7, padding: '6px 10px',
                  border: '1.5px solid #F6A000', marginBottom: 6,
                  boxShadow: '0 1px 6px rgba(246,160,0,0.15)' }}>
                  <p style={{ color: '#92400e', fontSize: 8, margin: '0 0 2px 0', fontFamily: gujFont,
                    letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    નોંધણી નંબર / Registration No.
                  </p>
                  <p style={{ color: '#F6A000', fontWeight: 'bold', fontSize: 20, margin: 0,
                    letterSpacing: '2px', fontFamily: "'Arial', sans-serif", lineHeight: 1 }}>
                    {patient.registration_number}
                  </p>
                </div>

                {/* Chief complaint */}
                <p style={{ color: '#6b7280', fontSize: 9, margin: 0, fontFamily: gujFont }}>
                  🩺 {patient.chief_complaint}
                </p>
              </div>
            </div>

            {/* ── Green Footer ── */}
            <div style={{
              background: 'linear-gradient(135deg, #39A900 0%, #2d8700 100%)',
              padding: '8px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: 11, fontWeight: '600', margin: 0,
                fontFamily: gujFont }}>
                ✨ ક્ષતિહીન શરીર, ગતિશીલ જીવન
              </p>
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, margin: 0,
                fontFamily: "'Arial', sans-serif" }}>
                📞 63551 08454
              </p>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-4 pb-4">
          <button onClick={downloadImage}
            disabled={!!patient.photo_url && !photoBase64}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#39A900' }}>
            <Download size={16} />
            {patient.photo_url && !photoBase64 ? 'ફોટો લોડ...' : 'JPG ડાઉનલોડ'}
          </button>
          <button onClick={shareImage}
            disabled={!!patient.photo_url && !photoBase64}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#F6A000' }}>
            <Share2 size={16} />
            {patient.photo_url && !photoBase64 ? 'ફોટો લોડ...' : 'શેર કરો'}
          </button>
        </div>
      </div>
    </div>
  )
}
