import { createClient } from '@/lib/supabase/server'
import { mapAsset, mapLayer, mapCollection, mapKeyword, mapColorUnlock, mapColorPalette } from '@/lib/supabase/mappers'
import type { ColorPalette } from '@/types'
import Studio from '@/components/admin/Studio'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: rawCollections }   = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }        = await supabase.from('layers').select('*').order('order_index')
  const { data: rawAssets }        = await supabase.from('assets').select('*').order('created_at', { ascending: false })
  const { data: rawKeywords }      = await supabase.from('keywords').select('*').order('created_at')
  const { data: rawColorUnlocks }  = await supabase.from('color_unlocks').select('*')

  // Tabla nueva — puede no existir aún si la migración 013 no se aplicó todavía
  let colorPalettes: ColorPalette[] = []
  try {
    const { data: rawPalettes } = await supabase.from('color_palettes').select('*')
    colorPalettes = (rawPalettes || []).map(mapColorPalette)
  } catch {
    colorPalettes = []
  }

  return (
    <Studio
      collections={(rawCollections || []).map(mapCollection)}
      layers={(rawLayers || []).map(mapLayer)}
      assets={(rawAssets || []).map(mapAsset)}
      keywords={(rawKeywords || []).map(mapKeyword)}
      colorUnlocks={(rawColorUnlocks || []).map(mapColorUnlock)}
      colorPalettes={colorPalettes}
    />
  )
}
