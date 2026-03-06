import { useRef } from 'react'
import html2canvas from 'html2canvas'
import { Download, X, Share2 } from 'lucide-react'
import type { Patient } from '../types'

interface Props { patient: Patient; onClose: () => void }

export default function WelcomeImageModal({ patient, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  async function downloadImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null })
    const link = document.createElement('a')
    link.download = `Welcome-${patient.registration_number}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
  }

  async function shareImage() {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null })
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `Welcome-${patient.registration_number}.jpg`, { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'NFC Welcome Card' })
      } else {
        downloadImage()
      }
    }, 'image/jpeg', 0.95)
  }

  const feesText = patient.fees_type === 'per_session'
    ? `₹${patient.fees_amount} per session`
    : `₹${patient.fees_amount} (Package)`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Welcome Card Ready</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Welcome Card (this gets rendered to image) */}
        <div className="p-4 bg-gray-50">
          <div ref={cardRef} className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #fff8ed 0%, #f0fce8 100%)', fontFamily: 'Arial, sans-serif' }}>

            {/* Card Header */}
            <div style={{ background: 'linear-gradient(135deg, #F6A000, #e09000)', padding: '20px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 40 40" width="32" height="32">
                    <circle cx="20" cy="20" r="18" fill="#F6A000" />
                    <circle cx="20" cy="12" r="4" fill="white" />
                    <path d="M12 26 Q16 20 20 18 Q24 20 28 26" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <path d="M14 32 L16 25 M26 32 L24 25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: 18, margin: 0, lineHeight: 1.2 }}>Nijanand</p>
                  <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 13, margin: 0 }}>Fitness Centre</p>
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 4px 0' }}>Welcome to NFC Family!</p>
              <h2 style={{ color: '#1f2937', fontWeight: 'bold', fontSize: 20, margin: '0 0 16px 0' }}>
                Dear {patient.name},
              </h2>

              {/* Registration Number Box */}
              <div style={{ background: 'white', borderRadius: 12, padding: '16px 20px',
                border: '2px solid #F6A000', marginBottom: 16, boxShadow: '0 2px 8px rgba(246,160,0,0.15)' }}>
                <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Registration Number
                </p>
                <p style={{ color: '#F6A000', fontWeight: 'bold', fontSize: 22, margin: 0, letterSpacing: '0.05em' }}>
                  {patient.registration_number}
                </p>
              </div>

              {/* Fees */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                background: '#f0fce8', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>💰</span>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 10, margin: 0 }}>Consultation Fees</p>
                  <p style={{ color: '#39A900', fontWeight: 'bold', fontSize: 14, margin: 0 }}>{feesText}</p>
                </div>
              </div>

              <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Please keep this registration number for all future visits. We look forward to supporting your health journey.
              </p>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: '#39A900', fontWeight: 'bold', fontSize: 11, margin: 0 }}>
                  Movement is Medicine
                </p>
                <p style={{ color: '#9ca3af', fontSize: 11, margin: 0 }}>📞 63551 08454</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={downloadImage}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#39A900' }}>
            <Download size={16} /> Download JPG
          </button>
          <button onClick={shareImage}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#F6A000' }}>
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>
    </div>
  )
}
