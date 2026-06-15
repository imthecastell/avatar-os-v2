'use client'

import { useState, useRef } from 'react'
import { detectLayerFromFilename } from '@/lib/engine/asset-classifier'
import type { Collection } from '@/types'

interface UploadResult {
  filename:      string
  detectedLayer: string | null
  status:        'ready' | 'needs-layer' | 'uploading' | 'done' | 'error'
  error?:        string
  cdnUrl?:       string
  assignedLayer?: string
}

const LAYER_OPTIONS = [
  'background', 'emotion', 'head', 'hair-back', 'hair-front',
  'shirt', 'acc-front', 'mask', 'effect-final', 'frame',
]

import type { Layer } from '@/types'

interface Props {
  collections: Collection[]
  layers: Layer[]
}

export default function BatchUploader({ collections, layers }: Props) {
  const [collectionId, setCollectionId] = useState(collections[0]?.id || '')
  const [results, setResults] = useState<UploadResult[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function processFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const valid = arr.filter(f =>
      ['svg', 'png', 'jpg', 'jpeg'].some(ext => f.name.toLowerCase().endsWith(ext))
    )

    const newResults: UploadResult[] = valid.map(f => ({
      filename: f.name,
      detectedLayer: detectLayerFromFilename(f.name),
      status: detectLayerFromFilename(f.name) ? 'ready' : 'needs-layer',
      assignedLayer: detectLayerFromFilename(f.name) || '',
    }))

    setResults(prev => [...prev, ...newResults])

    // Auto-upload those with detected layers
    valid.forEach((file, i) => {
      if (newResults[i].detectedLayer) {
        uploadFile(file, newResults[i].detectedLayer!, results.length + i)
      }
    })
  }

  async function uploadFile(file: File, layerKey: string, index: number) {
    setResults(prev => prev.map((r, i) =>
      i === index ? { ...r, status: 'uploading' } : r
    ))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('layer', layerKey)
    formData.append('collectionId', collectionId)

    try {
      const res = await fetch('/api/assets/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setResults(prev => prev.map((r, i) =>
        i === index ? { ...r, status: 'done', cdnUrl: data.cdnUrl } : r
      ))
    } catch (err: unknown) {
      setResults(prev => prev.map((r, i) =>
        i === index
          ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'Error' }
          : r
      ))
    }
  }

  function assignAndUpload(file: File, layerKey: string, index: number) {
    setResults(prev => prev.map((r, i) =>
      i === index ? { ...r, assignedLayer: layerKey, status: 'ready' } : r
    ))
    // We need the file reference — store in a ref map for production; for now re-upload via input
    // This flow works when user manually assigns and clicks upload
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-medium text-white">Cargar assets</h2>
        {collections.length > 1 && (
          <select
            value={collectionId}
            onChange={e => setCollectionId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white"
          >
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          dragging ? 'border-violet-500 bg-violet-500/5' : 'border-gray-700'
        }`}
      >
        <p className="text-sm text-gray-400 mb-3">Arrastra archivos aquí o selecciona</p>
        <label className="inline-block bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors">
          Seleccionar archivos
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => e.target.files && processFiles(e.target.files)}
          />
        </label>
        <p className="text-xs text-gray-600 mt-2">SVG · PNG · JPG</p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div key={`${r.filename}-${i}`} className="flex items-center gap-3 text-sm bg-gray-800 rounded-lg px-3 py-2">
              <span className={`text-lg ${
                r.status === 'done' ? '✓' : r.status === 'error' ? '✗' : r.status === 'uploading' ? '⟳' : '○'
              }`}>
                {r.status === 'done' ? '✓' : r.status === 'error' ? '✗' : r.status === 'uploading' ? '⟳' : '·'}
              </span>

              <span className="flex-1 text-gray-300 truncate text-xs">{r.filename}</span>

              {r.detectedLayer ? (
                <span className="text-xs text-violet-400">{r.detectedLayer}</span>
              ) : (
                <select
                  className="bg-gray-700 border border-gray-600 rounded text-xs text-white px-1 py-0.5"
                  onChange={e => assignAndUpload(new File([], r.filename), e.target.value, i)}
                  defaultValue=""
                >
                  <option value="" disabled>Asignar capa</option>
                  {LAYER_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}

              {r.status === 'error' && (
                <span className="text-xs text-red-400">{r.error}</span>
              )}
            </div>
          ))}

          <button
            onClick={() => setResults([])}
            className="text-xs text-gray-500 hover:text-white mt-1"
          >
            Limpiar lista
          </button>
        </div>
      )}
    </div>
  )
}
