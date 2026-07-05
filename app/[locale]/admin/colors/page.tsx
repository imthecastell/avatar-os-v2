import { createClient } from '@/lib/supabase/server'
import { mapCollection, mapColorPalette } from '@/lib/supabase/mappers'
import ColorPalettesPanel from '@/components/admin/ColorPalettesPanel'

export const dynamic = 'force-dynamic'

export default async function AdminColorsPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawPalettes }    = await supabase.from('color_palettes').select('*')

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold text-white mb-1">Paletas de color</h1>
      <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Muestras rápidas que el builder ofrece para piel, cabello, ropa y accesorios — el usuario siempre puede personalizar con la rueda de color libre para casos especiales.
      </p>
      <ColorPalettesPanel
        collections={(rawCollections || []).map(mapCollection)}
        palettes={(rawPalettes || []).map(mapColorPalette)}
      />
    </div>
  )
}
