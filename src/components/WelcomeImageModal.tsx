import { useRef } from 'react'
import html2canvas from 'html2canvas'
import { Download, X, Share2 } from 'lucide-react'
import type { Patient } from '../types'

interface Props { patient: Patient; onClose: () => void }

export default function WelcomeImageModal({ patient, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  async function downloadImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      allowTaint: true,
    })
    const link = document.createElement('a')
    link.download = `Welcome-${patient.registration_number}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
  }

  async function shareImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      allowTaint: true,
    })
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `Welcome-${patient.registration_number}.jpg`, { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'NFC સ્વાગત કાર્ડ' })
      } else {
        downloadImage()
      }
    }, 'image/jpeg', 0.95)
  }

  const feesText = patient.fees_type === 'per_session'
    ? `₹${patient.fees_amount} પ્રતિ સત્ર`
    : `₹${patient.fees_amount} (પેકેજ)`

  const gujFont = "'Anek Gujarati', Arial, sans-serif"

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">સ્વાગત કાર્ડ તૈયાર છે</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Welcome Card — rendered to image */}
        <div className="p-4 bg-gray-50">
          <div ref={cardRef} style={{
            background: 'linear-gradient(145deg, #fff8ed 0%, #f0fce8 100%)',
            fontFamily: gujFont,
            borderRadius: 16,
            overflow: 'hidden',
          }}>

            {/* Card Header with logo */}
            <div style={{ background: 'linear-gradient(135deg, #F6A000, #e09000)', padding: '18px 22px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src="/logo.png"
                  alt="Nijanand Logo"
                  crossOrigin="anonymous"
                  style={{ width: 52, height: 52, borderRadius: '50%', background: 'white',
                    objectFit: 'cover', flexShrink: 0, padding: 3 }}
                />
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: 18, margin: 0, lineHeight: 1.2,
                    fontFamily: gujFont }}>
                    નિજાનંદ
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: '600', fontSize: 13, margin: 0,
                    fontFamily: gujFont }}>
                    ફિટનેસ સેન્ટર
                  </p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div style={{ padding: '18px 22px' }}>

              <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 3px 0', fontFamily: gujFont }}>
                NFC પરિવારમાં આપનું સ્વાગત છે! 🎉
              </p>
              <h2 style={{ color: '#1f2937', fontWeight: 'bold', fontSize: 19, margin: '0 0 14px 0',
                fontFamily: gujFont }}>
                પ્રિય {patient.name},
              </h2>

              {/* Registration Number Box */}
              <div style={{
                background: 'white', borderRadius: 12, padding: '14px 18px',
                border: '2px solid #F6A000', marginBottom: 14,
                boxShadow: '0 2px 8px rgba(246,160,0,0.15)'
              }}>
                <p style={{ color: '#6b7280', fontSize: 10, margin: '0 0 4px 0',
                  textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: gujFont }}>
                  આપનો નોંધણી નંબર
                </p>
                <p style={{ color: '#F6A000', fontWeight: 'bold', fontSize: 22, margin: 0,
                  letterSpacing: '0.05em', fontFamily: "'Arial', sans-serif" }}>
                  {patient.registration_number}
                </p>
              </div>

              {/* Fees */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#f0fce8', borderRadius: 10, padding: '10px 14px', marginBottom: 14
              }}>
                <span style={{ fontSize: 16 }}>💰</span>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 10, margin: 0, fontFamily: gujFont }}>સત્ર ફી</p>
                  <p style={{ color: '#39A900', fontWeight: 'bold', fontSize: 14, margin: 0, fontFamily: gujFont }}>
                    {feesText}
                  </p>
                </div>
              </div>

              <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 14px 0', lineHeight: 1.6,
                fontFamily: gujFont }}>
                ભવિષ્યની તમામ મુલાકાત માટે આ નોંધણી નંબર સાચવો.
                આપની આરોગ્યયાત્રામાં સહાય કરવા અમે સદૈવ તત્પર છીએ.
              </p>

              {/* Footer */}
              <div style={{
                borderTop: '1px solid #e5e7eb', paddingTop: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <p style={{ color: '#39A900', fontWeight: 'bold', fontSize: 11, margin: 0, fontFamily: gujFont }}>
                  ચળવળ એ દવા છે 💪
                </p>
                <p style={{ color: '#9ca3af', fontSize: 11, margin: 0, fontFamily: "'Arial', sans-serif" }}>
                  📞 63551 08454
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={downloadImage}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#39A900' }}>
            <Download size={16} /> JPG ડાઉનલોડ
          </button>
          <button onClick={shareImage}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#F6A000' }}>
            <Share2 size={16} /> શેર કરો
          </button>
        </div>
      </div>
    </div>
  )
}
