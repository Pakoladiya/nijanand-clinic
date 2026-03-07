import { useRef } from 'react'
import { Camera, RefreshCw, Check, Image } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  captured: string | null
}

// Resize & compress image to max 800x800, JPEG quality 0.75
// This reduces 5MB gallery photos down to ~100-200KB
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => resolve(dataUrl) // fallback: use original if error
    img.src = dataUrl
  })
}

export default function CameraCapture({ onCapture, captured }: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      if (ev.target?.result) {
        const compressed = await compressImage(ev.target.result as string)
        onCapture(compressed)
      }
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  if (captured) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img src={captured} alt="Patient" className="w-32 h-32 rounded-full object-cover border-4"
            style={{ borderColor: '#39A900' }} />
          <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#39A900' }}>
            <Check size={14} color="white" />
          </div>
        </div>
        <button type="button" onClick={() => onCapture('')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw size={14} /> Retake Photo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
        <Camera size={32} className="text-gray-400" />
      </div>
      <div className="flex gap-2">
        {/* Opens camera app directly */}
        <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer"
          style={{ backgroundColor: '#F6A000' }}>
          <Camera size={16} /> Open Camera
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleFile} />
        </label>
        {/* Opens gallery */}
        <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-300 cursor-pointer hover:bg-gray-50">
          <Image size={16} /> Gallery
          <input ref={galleryInputRef} type="file" accept="image/*"
            className="hidden" onChange={handleFile} />
        </label>
      </div>
    </div>
  )
}
