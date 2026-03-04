'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface UploadedFile {
  fileUrl: string
  fileName: string
  fileSize: number
  fileType: string
}

interface FileUploadProps {
  entityType: 'audit' | 'finding' | 'document' | 'cap'
  entityId: string
  onUploadComplete: (file: UploadedFile) => void
  onUploadError?: (error: string) => void
  maxFiles?: number
  acceptedFileTypes?: string[]
  className?: string
  disabled?: boolean
}

export const FileUpload = ({
  entityType,
  entityId,
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  disabled = false,
  acceptedFileTypes = [
    'image/*',
    'application/pdf',
    'video/*',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  className,
}: FileUploadProps) => {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > maxFiles) {
        onUploadError?.(`Maximum ${maxFiles} files allowed`)
        return
      }

      for (const file of acceptedFiles) {
        await uploadFile(file)
      }
    },
    [entityType, entityId, onUploadComplete, onUploadError, maxFiles]
  )

  const uploadFile = async (file: File) => {
    setUploading(true)
    const fileId = `${file.name}-${Date.now()}`

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', entityType)
      formData.append('entityId', entityId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      onUploadComplete(data)
      setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }))
    } catch (error: any) {
      console.error('Upload error:', error)
      onUploadError?.(error.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      setTimeout(() => {
        setUploadProgress((prev) => {
          const newProgress = { ...prev }
          delete newProgress[fileId]
          return newProgress
        })
      }, 2000)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = []
      return acc
    }, {} as Record<string, string[]>),
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    disabled: uploading || disabled,
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-sm font-medium">Drop files here...</p>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: Images, PDFs, Videos, Documents (Max 10MB per file)
            </p>
          </div>
        )}
      </div>
      {uploading && (
        <div className="text-sm text-muted-foreground text-center">
          Uploading...
        </div>
      )}
    </div>
  )
}

interface FileListItem extends UploadedFile {
  id?: string
}

interface FileListProps {
  files: FileListItem[]
  onRemove?: (fileUrl: string) => void
  onDeleteEvidence?: (evidenceId: string) => void
  showDownload?: boolean
  showUrl?: boolean
}

export const FileList = ({
  files,
  onRemove,
  onDeleteEvidence,
  showDownload = true,
  showUrl = true,
}: FileListProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return '🖼️'
    } else if (fileType === 'application/pdf') {
      return '📄'
    } else if (fileType.startsWith('video/')) {
      return '🎥'
    } else {
      return '📎'
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
  }

  if (files.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Uploaded Files</h4>
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={file.id ?? index}
            className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-accent/50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl shrink-0">{getFileIcon(file.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)} • {file.fileType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showDownload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(file.fileUrl, '_blank')}
                    aria-label={`Open ${file.fileName}`}
                  >
                    Open
                  </Button>
                )}
                {showUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(file.fileUrl)}
                    aria-label="Copy file URL"
                  >
                    Copy link
                  </Button>
                )}
                {file.id && onDeleteEvidence ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEvidence(file.id!)}
                    aria-label={`Delete ${file.fileName}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : onRemove ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(file.fileUrl)}
                    aria-label={`Remove ${file.fileName}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            {showUrl && (
              <p className="text-xs text-muted-foreground truncate pl-11" title={file.fileUrl}>
                {file.fileUrl}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
