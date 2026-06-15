'use client'

const SKIN_TONES = [
  { hex: '#FDDBB4', name: 'Muy claro' },
  { hex: '#F9C7B6', name: 'Claro' },
  { hex: '#EBA882', name: 'Medio claro' },
  { hex: '#D4895A', name: 'Medio' },
  { hex: '#B86A35', name: 'Medio oscuro' },
  { hex: '#8B4513', name: 'Oscuro' },
  { hex: '#5C2D0A', name: 'Muy oscuro' },
  { hex: '#3B1A08', name: 'Profundo' },
]

interface Props {
  value: string
  onChange: (hex: string) => void
}

export default function SkinSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SKIN_TONES.map(tone => (
        <button
          key={tone.hex}
          title={tone.name}
          onClick={() => onChange(tone.hex)}
          className={`w-8 h-8 rounded-full transition-all ${
            value === tone.hex
              ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-gray-900 scale-110'
              : 'hover:scale-105 ring-1 ring-white/10'
          }`}
          style={{ backgroundColor: tone.hex }}
        />
      ))}
    </div>
  )
}

export { SKIN_TONES }
