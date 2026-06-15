import { createClient } from '@/lib/supabase/server'
import { mapLayer, mapLayerException, mapLayerDefault, mapCollection, mapAsset } from '@/lib/supabase/mappers'
import LayerSandwich from '@/components/admin/LayerSandwich'

export default async function AdminLayersPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }      = await supabase.from('layers').select('*').order('order_index')
  const { data: rawAssets }      = await supabase.from('assets').select('*')

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-6">Capas</h1>
      <LayerSandwich
        collections={(rawCollections || []).map(mapCollection)}
        layers={(rawLayers || []).map(mapLayer)}
        assets={(rawAssets || []).map(mapAsset)}
      />
    </div>
  )
}
