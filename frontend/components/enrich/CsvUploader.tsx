'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText } from 'lucide-react'

interface CsvUploaderProps {
  onUpload: (headers: string[], rows: string[][]) => void
}

export function CsvUploader({ onUpload }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setFileName(file.name)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line =>
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      )
      onUpload(headers, rows)
    }
    reader.readAsText(file)
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
        isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-muted-foreground/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4">
        {fileName ? (
          <FileText size={48} className="text-emerald-500" />
        ) : (
          <Upload size={48} className="text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">{fileName || 'Drop a CSV file here, or click to browse'}</p>
          <p className="text-sm text-muted-foreground mt-1">Supports .csv files with headers</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <label className="inline-flex items-center px-4 py-2 rounded-lg border cursor-pointer hover:bg-accent transition-colors text-sm">
          Browse Files
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}
