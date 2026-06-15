'use client'

import { useState } from 'react'

const HAIR_PRESETS = [
  { hex: '#1A1A1A', name: 'Negro' },
  { hex: '#3B2314', name: 'Castaño oscuro' },
  { hex: '#6B3A2A', name: 'Castaño' },
  { hex: '#A0522D', name: 'Castaño claro' },
  { hex: '#C9A96E', name: 'Rubio oscuro' },
  { hex: '#E8D5A3', name: 'Rubio' },
  { hex: '#B22222', name: 'Rojo' },
  { hex: '#708090', name: 'Gris' },
]

interface Props {
  value: string
  onChange: (hex: string) => void
}

export default function HairColorPicker({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {HAIR_PRESETS.map(preset => (
        <button
          key={preset.hex}
          title={preset.name}
          onClick={() => onChange(preset.hex)}
          className={`w-8 h-8 rounded-full transition-all ${
            value === preset.hex
              ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-gray-900 scale-110'
              : 'hover:scale-105 ring-1 ring-white/10'
          }`}
          style={{ backgroundColor: preset.hex }}
        />
      ))}

      <div className="relative">
        <button
          title="Color personalizado"
          onClick={() => setShowPicker(!showPicker)}
          className="w-8 h-8 rounded-full border-2 border-dashed border-gray-500 hover:border-violet-400 flex items-center justify-center text-gray-400 hover:text-violet-400 text-xs transition-colors"
          style={
            !HAIR_PRESETS.find(p => p.hex === value)
              ? { backgroundColor: value, borderStyle: 'solid', borderColor: '#8b5cf6' }
              : {}
          }
        >
          {HAIR_PRESETS.find(p => p.hex === value) ? '🎨' : ''}
        </button>

        {showPicker && (
          <div className="absolute bottom-10 left-0 z-10 bg-gray-800 rounded-xl p-3 shadow-xl border border-gray-700">
            <input
              type="color"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-32 h-10 rounded cursor-pointer"
            />
            <button
              onClick={() => setShowPicker(false)}
              className="mt-2 w-full text-xs text-gray-400 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export { HAIR_PRESETS }
