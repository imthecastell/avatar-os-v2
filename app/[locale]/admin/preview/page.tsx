import { createClient } from '@/lib/supabase/server'
import { mapLayer, mapAsset, mapLayerDefault, mapCollection } from '@/lib/supabase/mappers'
import AdminPreview from '@/components/admin/AdminPreview'

export default async function AdminPreviewPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').eq('active', true).order('number')
  const { data: rawLayers }      = await supabase.from('layers').select('*').order('order_index')
  const { data: rawAssets }      = await supabase.from('assets').select('*')
  const { data: rawDefaults }    = await supabase.from('layer_defaults').select('*')

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-6">Preview</h1>
      <AdminPreview
        collections={(rawCollections || []).map(mapCollection)}
        layers={(rawLayers || []).map(mapLayer)}
        assets={(rawAssets || []).map(mapAsset)}
        defaults={(rawDefaults || []).map(mapLayerDefault)}
      />
    </div>
  )
}
