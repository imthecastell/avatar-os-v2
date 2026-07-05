import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Mismo trío de acento (violeta/azul/rosa) en cabello, ropa y accesorios para
// que las cuatro paletas se sientan parte de una sola paleta de marca. Piel
// usa su propio trío (violeta/azul/verde, ya en uso) para no romper el
// significado de sus emojis 💜💙💚.
const FANTASY_ACCENT = [
  { hex: '#7C3AED', fantasy: true }, // violeta
  { hex: '#0EA5E9', fantasy: true }, // azul
  { hex: '#E91E8C', fantasy: true }, // rosa
]

const STANDARD_PALETTES = [
  {
    palette_key: 'skin', label_es: 'Tonos de piel', label_en: 'Skin tones',
    swatches: [
      { hex: '#F7DECE', fantasy: false },
      { hex: '#F3D2A2', fantasy: false },
      { hex: '#D5AB88', fantasy: false },
      { hex: '#AF7E57', fantasy: false },
      { hex: '#7C533E', fantasy: false },
      { hex: '#FFDC5D', fantasy: false },
      { hex: '#8B5CF6', fantasy: true },
      { hex: '#3B82F6', fantasy: true },
      { hex: '#10B981', fantasy: true },
    ],
  },
  {
    palette_key: 'hair', label_es: 'Cabello', label_en: 'Hair',
    swatches: [
      { hex: '#1A1A1A', fantasy: false },
      { hex: '#3B2314', fantasy: false },
      { hex: '#6B3A2A', fantasy: false },
      { hex: '#A0522D', fantasy: false },
      { hex: '#C9A96E', fantasy: false },
      { hex: '#E8D5A3', fantasy: false },
      { hex: '#B22222', fantasy: false },
      { hex: '#708090', fantasy: false },
      ...FANTASY_ACCENT,
    ],
  },
  {
    palette_key: 'clothing', label_es: 'Ropa', label_en: 'Clothing',
    swatches: [
      { hex: '#FFFFFF', fantasy: false }, // blanco
      { hex: '#1A1A1A', fantasy: false }, // negro
      { hex: '#6B7280', fantasy: false }, // gris
      { hex: '#2C3E50', fantasy: false }, // azul marino
      { hex: '#1E3A5F', fantasy: false }, // denim
      { hex: '#8B7355', fantasy: false }, // khaki
      { hex: '#D4A373', fantasy: false }, // beige
      { hex: '#7F1D1D', fantasy: false }, // vino
      ...FANTASY_ACCENT,
    ],
  },
  {
    palette_key: 'accessories', label_es: 'Accesorios', label_en: 'Accessories',
    swatches: [
      { hex: '#1A1A1A', fantasy: false }, // negro
      { hex: '#FFFFFF', fantasy: false }, // blanco/transparente
      { hex: '#708090', fantasy: false }, // gunmetal
      { hex: '#8B5A2B', fantasy: false }, // carey
      { hex: '#C9A96E', fantasy: false }, // dorado
      { hex: '#C0C0C0', fantasy: false }, // plateado
      ...FANTASY_ACCENT,
    ],
  },
]

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { collectionId } = await request.json()
  if (!collectionId) return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 })

  const rows = STANDARD_PALETTES.map(p => ({ ...p, collection_id: collectionId }))

  const { data, error } = await supabase
    .from('color_palettes')
    .upsert(rows, { onConflict: 'collection_id,palette_key', ignoreDuplicates: true })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data?.length ?? 0 })
}
