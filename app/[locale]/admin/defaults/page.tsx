import { createClient } from '@/lib/supabase/server'
import { mapCollection, mapLayerDefault } from '@/lib/supabase/mappers'
import LayerDefaultsPanel from '@/components/admin/LayerDefaultsPanel'

export default async function AdminDefaultsPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawDefaults }    = await supabase.from('layer_defaults').select('*')

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold text-white mb-1">Valores por defecto</h1>
      <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Colores iniciales que el builder usa cuando el usuario lo abre por primera vez.
      </p>
      <LayerDefaultsPanel
        collections={(rawCollections || []).map(mapCollection)}
        defaults={(rawDefaults || []).map(mapLayerDefault)}
      />
    </div>
  )
}
