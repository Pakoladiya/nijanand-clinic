import { useState, useRef, useCallback } from 'react'
import { Camera, RefreshCw, Check, Upload } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  captured: string | null
}

export default function CameraCapture({ onCapture, captured }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStreaming(true)
      }
    } catch {
      setError('Camera access denied. Please allow camera permission.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setStreaming(false)
  }, [])

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    onCapture(dataUrl)
    stopCamera()
  }, [onCapture, stopCamera])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      if (ev.target?.result) onCapture(ev.target.result as string)
    }
    reader.readAsDataURL(file)
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
        <button type="button" onClick={() => { onCapture(''); stopCamera() }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw size={14} /> Retake Photo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {streaming ? (
        <div className="flex flex-col items-center gap-3">
          <video ref={videoRef} className="w-48 h-36 rounded-xl object-cover bg-black" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button type="button" onClick={takePhoto}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: '#39A900' }}>
              <Camera size={16} /> Capture
            </button>
            <button type="button" onClick={stopCamera}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
            <Camera size={32} className="text-gray-400" />
          </div>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={startCamera}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: '#F6A000' }}>
              <Camera size={16} /> Open Camera
            </button>
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-300 cursor-pointer hover:bg-gray-50">
              <Upload size={16} /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
