'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

export interface SignaturePadHandle {
  isEmpty: () => boolean
  clear: () => void
  /** PNG data URL, ink on white, scaled to at most 900px wide. */
  toDataURL: () => string | null
}

/**
 * A finger / stylus / mouse signature box. Pointer events cover all three, and
 * `touch-action: none` stops the page from scrolling while the client signs —
 * the single thing that makes signing on a phone feel broken.
 *
 * No library: this is ~100 lines, and a dependency here would mean a lockfile
 * change in a repo whose Dockerfile installs with --frozen-lockfile.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; className?: string }>(
  function SignaturePad({ onChange, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const last = useRef<{ x: number; y: number } | null>(null)
    const strokes = useRef(0)
    const [empty, setEmpty] = useState(true)

    const setEmptyState = useCallback((v: boolean) => {
      setEmpty(v)
      onChange?.(v)
    }, [onChange])

    // Size the bitmap to the element at device pixel ratio so ink is sharp.
    // Resizing wipes the canvas, so only do it while still empty (rotating a
    // tablet mid-signature would otherwise erase it).
    const fit = useCallback(() => {
      const c = canvasRef.current
      if (!c || strokes.current > 0) return
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const { width, height } = c.getBoundingClientRect()
      c.width = Math.round(width * dpr)
      c.height = Math.round(height * dpr)
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2.4
    }, [])

    useEffect(() => {
      fit()
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }, [fit])

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drawing.current = true
      const p = point(e)
      last.current = p
      // A tap is a dot.
      const ctx = e.currentTarget.getContext('2d')!
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
    }

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return
      e.preventDefault()
      const ctx = e.currentTarget.getContext('2d')!
      const p = point(e)
      // Stylus pressure when there is one; finger and mouse report 0.5.
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5
      ctx.lineWidth = 1.4 + pressure * 2.2
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      last.current = p
    }

    const up = () => {
      if (!drawing.current) return
      drawing.current = false
      last.current = null
      strokes.current += 1
      if (empty) setEmptyState(false)
    }

    const clear = useCallback(() => {
      const c = canvasRef.current
      if (!c) return
      strokes.current = 0
      c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
      fit()
      setEmptyState(true)
    }, [fit, setEmptyState])

    useImperativeHandle(ref, () => ({
      isEmpty: () => strokes.current === 0,
      clear,
      toDataURL: () => {
        const c = canvasRef.current
        if (!c || strokes.current === 0) return null
        const scale = Math.min(1, 900 / c.width)
        const out = document.createElement('canvas')
        out.width = Math.round(c.width * scale)
        out.height = Math.round(c.height * scale)
        const ctx = out.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.drawImage(c, 0, 0, out.width, out.height)
        return out.toDataURL('image/png')
      },
    }), [clear])

    return (
      <div className={className}>
        <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
          <canvas
            ref={canvasRef}
            aria-label="Signature area — sign with your finger"
            className="block h-48 w-full cursor-crosshair touch-none select-none sm:h-56"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          />
          {empty && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-slate-400">
              Sign here with your finger
            </span>
          )}
          <span className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-slate-300" />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={clear}
            disabled={empty}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            <Eraser className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>
    )
  },
)
