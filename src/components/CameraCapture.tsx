import { useRef } from 'react'
import { Camera, Image } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  captured: string | null
}

// Resize & compress image to max 800x800, JPEG quality 0.75
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
    img.onerror = () => resolve(dataUrl)
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
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Circle — tap to open camera */}
      <label className="cursor-pointer relative block">
        {captured ? (
          /* Photo captured — show it with a small camera overlay */
          <div className="relative w-16 h-16">
            <img src={captured} alt="Patient"
              className="w-16 h-16 rounded-full object-cover border-2"
              style={{ borderColor: '#39A900' }} />
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center shadow"
              style={{ backgroundColor: '#F6A000' }}>
              <Camera size={11} color="white" />
            </div>
          </div>
        ) : (
          /* No photo — dashed circle with camera icon */
          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed"
            style={{ borderColor: '#F6A000', backgroundColor: '#FEF3C7' }}>
            <Camera size={22} style={{ color: '#F6A000' }} />
          </div>
        )}
        {/* Hidden camera input */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleFile} />
      </label>

      {/* Gallery fallback — tiny text link */}
      <label className="cursor-pointer flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
        <Image size={10} />
        <span>Gallery</span>
        <input ref={galleryInputRef} type="file" accept="image/*"
          className="hidden" onChange={handleFile} />
      </label>
    </div>
  )
}
