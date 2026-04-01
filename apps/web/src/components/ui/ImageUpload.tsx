'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Film, AlertCircle, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

// ── Image Upload ──────────────────────────────────────────────

type ImageUploadProps = {
  value: string[]
  onChange: (urls: string[]) => void
  maxFiles?: number
  disabled?: boolean
  propertySlug?: string
}

export function ImageUpload({
  value,
  onChange,
  maxFiles = 10,
  disabled = false,
  propertySlug,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setError(null)

      // Validate file count
      const remaining = maxFiles - value.length
      if (files.length > remaining) {
        setError(`You can only add ${remaining} more image${remaining === 1 ? '' : 's'}.`)
        return
      }

      // Validate each file
      for (const file of files) {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setError(`"${file.name}" is not a supported format. Use JPEG, PNG, WebP, or AVIF.`)
          return
        }
        if (file.size > MAX_IMAGE_SIZE) {
          setError(`"${file.name}" exceeds 10 MB.`)
          return
        }
      }

      setIsUploading(true)
      setUploadCount(files.length)

      try {
        const uploadedUrls: string[] = []

        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          if (propertySlug) formData.append('propertySlug', propertySlug)

          const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message || err.error || `Upload failed (${res.status})`)
          }

          const data = await res.json()
          uploadedUrls.push(data.url)
        }

        onChange([...value, ...uploadedUrls])
      } catch (err: any) {
        setError(err.message || 'Upload failed. Please try again.')
      } finally {
        setIsUploading(false)
        setUploadCount(0)
      }
    },
    [value, onChange, maxFiles],
  )

  const handleDelete = useCallback(
    async (url: string) => {
      try {
        await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
      } catch {
        // Best-effort delete from R2; still remove from local state
      }
      onChange(value.filter((u) => u !== url))
    },
    [value, onChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled || isUploading) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length) uploadFiles(files)
    },
    [disabled, isUploading, uploadFiles],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled && !isUploading) setIsDragging(true)
    },
    [disabled, isUploading],
  )

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length) uploadFiles(files)
      // Reset so selecting the same file again triggers onChange
      e.target.value = ''
    },
    [uploadFiles],
  )

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6
          transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
          ${(disabled || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">
              Uploading {uploadCount} file{uploadCount > 1 ? 's' : ''}...
            </p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              Drag & drop images here, or <span className="text-blue-600 underline">browse</span>
            </p>
            <p className="text-xs text-gray-400">
              JPEG, PNG, WebP, AVIF &middot; max 10 MB each &middot; {value.length}/{maxFiles}
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Thumbnails */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((url) => (
            <div key={url} className="relative group aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                <ImageIcon className="h-6 w-6 text-gray-500" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(url)
                }}
                className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Video Upload ──────────────────────────────────────────────

type VideoUploadProps = {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  propertySlug?: string
}

export function VideoUpload({
  value,
  onChange,
  disabled = false,
  propertySlug,
}: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        setError('Unsupported format. Use MP4, WebM, or MOV.')
        return
      }
      if (file.size > MAX_VIDEO_SIZE) {
        setError('File exceeds 100 MB.')
        return
      }

      setIsUploading(true)

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (propertySlug) formData.append('propertySlug', propertySlug)

        const res = await fetch(`${API_BASE_URL}/api/upload/video`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || `Upload failed (${res.status})`)
        }

        const data = await res.json()
        onChange(data.url)
      } catch (err: any) {
        setError(err.message || 'Upload failed. Please try again.')
      } finally {
        setIsUploading(false)
      }
    },
    [onChange],
  )

  const handleDelete = useCallback(async () => {
    if (!value) return
    try {
      await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      })
    } catch {
      // Best-effort
    }
    onChange('')
  }, [value, onChange])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled || isUploading) return
      const file = e.dataTransfer.files[0]
      if (file) uploadFile(file)
    },
    [disabled, isUploading, uploadFile],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled && !isUploading) setIsDragging(true)
    },
    [disabled, isUploading],
  )

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) uploadFile(file)
      e.target.value = ''
    },
    [uploadFile],
  )

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          <video
            src={value}
            controls
            className="w-full max-h-48 object-contain"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6
            transition-colors cursor-pointer
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }
            ${(disabled || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || isUploading}
          />

          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600">Uploading video...</p>
            </>
          ) : (
            <>
              <Film className="h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-600">
                Drag & drop a video, or <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-xs text-gray-400">MP4, WebM, MOV &middot; max 100 MB</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
