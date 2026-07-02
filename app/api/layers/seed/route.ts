import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const STANDARD_LAYERS = [
  { order_index: 0,  layer_key: 'background',   label_es: 'Fondo',          label_en: 'Background',   type: 'image', blend_mode: 'source-over', color_token: null,         optional: false, locked: false, visible_in_builder: true  },
  { order_index: 1,  layer_key: 'emotion',       label_es: 'Emoción',        label_en: 'Emotion',      type: 'svg',   blend_mode: 'source-over', color_token: null,         optional: true,  locked: false, visible_in_builder: true  },
  { order_index: 2,  layer_key: 'hair-back',     label_es: 'Cabello atrás',  label_en: 'Back hair',    type: 'svg',   blend_mode: 'source-over', color_token: 'hair-color', optional: false, locked: false, visible_in_builder: true  },
  { order_index: 3,  layer_key: 'head',          label_es: 'Cabeza',         label_en: 'Head',         type: 'svg',   blend_mode: 'source-over', color_token: 'skin-color', optional: false, locked: false, visible_in_builder: true  },
  { order_index: 4,  layer_key: 'body',          label_es: 'Cuerpo',         label_en: 'Body',         type: 'svg',   blend_mode: 'source-over', color_token: 'skin-color', optional: false, locked: false, visible_in_builder: false },
  { order_index: 5,  layer_key: 'shirt',         label_es: 'Camiseta',       label_en: 'Shirt',        type: 'svg',   blend_mode: 'source-over', color_token: null,         optional: false, locked: false, visible_in_builder: true  },
  { order_index: 6,  layer_key: 'hair-front',    label_es: 'Cabello frente', label_en: 'Front hair',   type: 'svg',   blend_mode: 'source-over', color_token: 'hair-color', optional: false, locked: false, visible_in_builder: false },
  { order_index: 7,  layer_key: 'acc-front',     label_es: 'Accesorio',      label_en: 'Accessory',    type: 'svg',   blend_mode: 'source-over', color_token: null,         optional: true,  locked: false, visible_in_builder: true  },
  { order_index: 8,  layer_key: 'mask',          label_es: 'Máscara',        label_en: 'Mask',         type: 'svg',   blend_mode: 'source-over', color_token: null,         optional: true,  locked: false, visible_in_builder: false },
  { order_index: 9,  layer_key: 'effect-final',  label_es: 'Efecto final',   label_en: 'Final effect', type: 'svg',   blend_mode: 'source-over', color_token: null,         optional: true,  locked: false, visible_in_builder: false },
  { order_index: 10, layer_key: 'frame',         label_es: 'Marco',          label_en: 'Frame',        type: 'image', blend_mode: 'source-over', color_token: null,         optional: true,  locked: false, visible_in_builder: false },
]

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { collectionId } = await request.json()
  if (!collectionId) return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 })

  const rows = STANDARD_LAYERS.map(l => ({ ...l, collection_id: collectionId }))

  const { data, error } = await supabase
    .from('layers')
    .upsert(rows, { onConflict: 'collection_id,layer_key', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data?.length ?? 0 })
}
