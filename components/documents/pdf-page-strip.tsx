'use client'

import { useEffect, useRef, useState } from 'react'

const THUMB_SCALE_HORIZONTAL = 1.2
const THUMB_SCALE_VERTICAL = 0.22
const THUMB_SCALE_GRID = 0.28

type PdfPageStripProps = {
  pdfUrl: string
  order: number[]
  selected: Set<number>
  onPageClick: (pageIndex: number) => void
  onReorder?: (fromPosition: number, toPosition: number) => void
  variant?: 'horizontal' | 'vertical' | 'grid'
  className?: string
  idPrefix?: string
}

export const PdfPageStrip = ({
  pdfUrl,
  order,
  selected,
  onPageClick,
  onReorder,
  variant = 'horizontal',
  className = '',
  idPrefix = 'h',
}: PdfPageStripProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null)
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null)
  const renderedRef = useRef<Set<string>>(new Set())
  const hasLoadedOnceRef = useRef(false)
  const scale =
    variant === 'vertical'
      ? THUMB_SCALE_VERTICAL
      : variant === 'grid'
        ? THUMB_SCALE_GRID
        : THUMB_SCALE_HORIZONTAL

  useEffect(() => {
    if (!pdfUrl || typeof window === 'undefined') return

    let cancelled = false
    const absoluteUrl = pdfUrl.startsWith('http') ? pdfUrl : `${window.location.origin}${pdfUrl}`

    const run = async () => {
      const isRefresh = hasLoadedOnceRef.current
      if (!isRefresh) setLoading(true)
      setError(null)
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

        const loadingTask = pdfjsLib.getDocument(absoluteUrl)
        const pdf = await loadingTask.promise
        if (cancelled) return

        const numPages = pdf.numPages
        renderedRef.current = new Set()

        for (let i = 0; i < order.length; i++) {
          if (cancelled) return
          const pageIndex = order[i]
          if (pageIndex < 0 || pageIndex >= numPages) continue

          const pageNum = pageIndex + 1
          const key = `${idPrefix}-pos-${i}-${pageIndex}`
          if (renderedRef.current.has(key)) continue

          const canvas = document.getElementById(`${idPrefix}-pdf-page-pos-${i}`) as HTMLCanvasElement | null
          if (!canvas) continue

          const page = await pdf.getPage(pageNum)
          if (cancelled) return

          const viewport = page.getViewport({ scale })
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          canvas.height = viewport.height
          canvas.width = viewport.width

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise
          if (cancelled) return
          renderedRef.current.add(key)
        }

        setError(null)
        if (!cancelled) hasLoadedOnceRef.current = true
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [pdfUrl, order.join(','), scale, idPrefix])

  if (error) {
    return (
      <div className={`flex items-center justify-center p-6 text-destructive text-sm ${className}`}>
        {error}
      </div>
    )
  }

  const isVertical = variant === 'vertical'
  const isGrid = variant === 'grid'
  const canDrag = Boolean(onReorder)

  const handleDragStart = (e: React.DragEvent, position: number) => {
    if (!canDrag) return
    e.dataTransfer.setData('text/plain', String(position))
    e.dataTransfer.effectAllowed = 'move'
    setDraggingPosition(position)
  }

  const handleDragOver = (e: React.DragEvent, position: number) => {
    if (!canDrag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPosition(position)
  }

  const handleDragLeave = () => {
    setDragOverPosition(null)
  }

  const handleDrop = (e: React.DragEvent, toPosition: number) => {
    if (!canDrag || !onReorder) return
    e.preventDefault()
    setDragOverPosition(null)
    setDraggingPosition(null)
    const fromPosition = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (Number.isInteger(fromPosition) && fromPosition !== toPosition) {
      onReorder(fromPosition, toPosition)
    }
  }

  const handleDragEnd = () => {
    setDraggingPosition(null)
    setDragOverPosition(null)
  }

  const containerClass = isVertical
    ? 'flex flex-col gap-2 overflow-y-auto overflow-x-hidden py-2 max-h-[70vh] pr-1'
    : isGrid
      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-y-auto py-4 max-h-[65vh]'
      : 'flex gap-3 overflow-x-auto overflow-y-hidden pb-2 py-4'

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading pages…
        </div>
      )}
      <div ref={containerRef} className={containerClass} style={{ direction: 'ltr' }}>
        {order.map((pageIndex, position) => (
          <button
            key={`${idPrefix}-${pageIndex}-${position}`}
            type="button"
            onClick={() => onPageClick(pageIndex)}
            draggable={canDrag}
            onDragStart={(e) => handleDragStart(e, position)}
            onDragOver={(e) => handleDragOver(e, position)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, position)}
            onDragEnd={handleDragEnd}
            className={`
              flex-shrink-0 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
              ${isVertical ? 'w-[120px]' : ''}
              ${isGrid ? 'flex flex-col items-center w-full max-w-[140px] justify-self-center' : ''}
              ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}
              ${draggingPosition === position ? 'opacity-50' : ''}
              ${dragOverPosition === position ? 'ring-2 ring-primary border-primary' : ''}
              ${selected.has(pageIndex)
                ? 'border-destructive ring-2 ring-destructive/50'
                : 'border-border hover:border-muted-foreground/50'}
            `}
            aria-label={`Page ${pageIndex + 1}${selected.has(pageIndex) ? ' (selected)' : ''}${canDrag ? ', drag to reorder' : ''}`}
            aria-pressed={selected.has(pageIndex)}
          >
            {!isGrid && (
              <div className="bg-muted/30 rounded-t-md px-1 py-0.5 text-xs font-medium text-muted-foreground w-full text-center">
                Page {pageIndex + 1}
              </div>
            )}
            <canvas
              id={`${idPrefix}-pdf-page-pos-${position}`}
              className={`block bg-white w-full ${isGrid ? 'rounded-t-md' : 'rounded-b-md'}`}
              style={{ direction: 'ltr', maxWidth: isVertical ? 100 : isGrid ? 140 : undefined }}
            />
            {isGrid && (
              <div className="bg-muted/30 rounded-b-md px-1 py-1 text-xs font-medium text-muted-foreground w-full text-center">
                {position + 1}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
