'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ImportResult = {
  ok: true
  recordsParsed: number
  nightsComputed: number
  elapsedMs: number
  dateRange: { from: string; to: string } | null
}

type ImportError = { ok: false; error: string }

export function ImportForm() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [result, setResult] = useState<ImportResult | ImportError | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'parsing'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File) {
    if (!/\.(zip|xml)$/i.test(f.name)) {
      setResult({ ok: false, error: `Unsupported file type: ${f.name} (expected .zip or .xml)` })
      return
    }
    setFile(f)
    setResult(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setPhase('uploading')
    setUploadPct(0)
    setResult(null)

    // Use XHR for upload progress tracking (fetch() doesn't expose it)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/health/import')
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
    }

    xhr.upload.onload = () => setPhase('parsing')

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as ImportResult | ImportError
        setResult(data)
      } catch {
        setResult({ ok: false, error: `Upload failed: ${xhr.status}` })
      } finally {
        setPhase('idle')
        setUploadPct(null)
      }
    }

    xhr.onerror = () => {
      setResult({ ok: false, error: 'Network error during upload' })
      setPhase('idle')
      setUploadPct(null)
    }

    xhr.send(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Apple Health Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-md border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pickFile(f)
            }}
          />

          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Drop your export.zip here</p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse (.zip or .xml)
              </p>
            </div>
          )}
        </div>

        {phase === 'uploading' && uploadPct != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Uploading…</span>
              <span>{uploadPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded">
              <div
                className="h-full bg-primary rounded transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'parsing' && (
          <div className="text-sm text-muted-foreground">
            Parsing XML and computing sleep scores… (this can take 1–2 minutes for a full export)
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleUpload} disabled={!file || phase !== 'idle'}>
            {phase !== 'idle' ? 'Processing…' : 'Import'}
          </Button>
          {file && phase === 'idle' && (
            <Button variant="outline" onClick={() => setFile(null)}>
              Clear
            </Button>
          )}
        </div>

        {result?.ok && (
          <div className="border border-green-600/30 bg-green-600/5 rounded-md p-3 text-sm space-y-1">
            <Badge className="bg-green-600">Import complete</Badge>
            <p>
              Parsed <strong>{result.recordsParsed.toLocaleString()}</strong> records,
              computed <strong>{result.nightsComputed.toLocaleString()}</strong> nights in{' '}
              {(result.elapsedMs / 1000).toFixed(1)}s
            </p>
            {result.dateRange && (
              <p className="text-muted-foreground">
                Range: {result.dateRange.from} → {result.dateRange.to}
              </p>
            )}
          </div>
        )}

        {result && !result.ok && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3 text-sm">
            <Badge variant="destructive">Error</Badge>
            <p className="mt-1">{result.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
