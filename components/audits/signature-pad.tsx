'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  onConfirm: (signatureDataUrl: string | null) => void
  onCancel: () => void
  disabled?: boolean
  className?: string
}

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 180

export const SignaturePad = ({
  onConfirm,
  onCancel,
  disabled = false,
  className,
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [insertedImageDataUrl, setInsertedImageDataUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      if ('touches' in e) {
        const touch = e.touches[0] ?? (e as React.TouchEvent).changedTouches[0]
        if (!touch) return null
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        }
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    []
  )

  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    },
    []
  )

  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (disabled) return
      const point = getPoint(e)
      if (point) {
        lastPointRef.current = point
        setIsDrawing(true)
        setHasDrawn(true)
      }
    },
    [disabled, getPoint]
  )

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (!isDrawing || disabled) return
      const point = getPoint(e)
      if (point && lastPointRef.current) {
        drawLine(lastPointRef.current, point)
        lastPointRef.current = point
      }
    },
    [isDrawing, disabled, getPoint, drawLine]
  )

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false)
    lastPointRef.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    setInsertedImageDataUrl(null)
  }, [])

  const getDataUrl = useCallback((): string | null => {
    if (!hasDrawn) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [hasDrawn])

  const handleConfirm = useCallback(() => {
    const dataUrl = getDataUrl()
    onConfirm(dataUrl)
  }, [getDataUrl, onConfirm])

  const handleInsertImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height,
            1
          )
          const w = img.width * scale
          const h = img.height * scale
          const x = (canvas.width - w) / 2
          const y = (canvas.height - h) / 2
          ctx.drawImage(img, x, y, w, h)
          setHasDrawn(true)
          setInsertedImageDataUrl(dataUrl)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const canConfirm = hasDrawn && !disabled

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Label id="signature-pad-label" className="text-sm font-medium">
          Sign below (draw with mouse or touch), or insert an image
        </Label>
        <div className="border rounded-lg bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-full touch-none border-0 block"
            style={{ maxHeight: CANVAS_HEIGHT }}
            aria-label="Signature pad - draw your signature or use insert image"
            role="img"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={disabled}
            aria-label="Clear signature"
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            aria-label="Insert signature image"
          >
            Insert image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden
            onChange={handleInsertImage}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          aria-label="Confirm signature"
        >
          Confirm signature
        </Button>
      </div>
    </div>
  )
}
