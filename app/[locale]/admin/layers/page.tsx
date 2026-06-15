import { createClient } from '@/lib/supabase/server'
import { mapLayer, mapLayerException, mapLayerDefault, mapCollection } from '@/lib/supabase/mappers'
import LayerStack from '@/components/admin/LayerStack'

export default async function AdminLayersPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }      = await supabase.from('layers').select('*').order('order_index')
  const { data: rawExceptions }  = await supabase.from('layer_exceptions').select('*')
  const { data: rawDefaults }    = await supabase.from('layer_defaults').select('*')

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-6">Capas</h1>
      <LayerStack
        collections={(rawCollections || []).map(mapCollection)}
        layers={(rawLayers || []).map(mapLayer)}
        exceptions={(rawExceptions || []).map(mapLayerException)}
        defaults={(rawDefaults || []).map(mapLayerDefault)}
      />
    </div>
  )
}
