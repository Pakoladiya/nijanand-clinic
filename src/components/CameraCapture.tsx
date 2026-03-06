import { useRef } from 'react'
import { Camera, RefreshCw, Check, Image } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  captured: string | null
}

export default function CameraCapture({ onCapture, captured }: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (ev.target?.result) onCapture(ev.target.result as string)
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
