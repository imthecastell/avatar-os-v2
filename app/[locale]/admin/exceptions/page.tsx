import { createClient } from '@/lib/supabase/server'
import { mapCollection, mapLayer, mapLayerException } from '@/lib/supabase/mappers'
import LayerExceptionsPanel from '@/components/admin/LayerExceptionsPanel'

export default async function AdminExceptionsPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }      = await supabase.from('layers').select('*').order('order_index')
  const { data: rawExceptions }  = await supabase.from('layer_exceptions').select('*').order('created_at')

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold text-white mb-1">Excepciones de capas</h1>
      <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Controla qué capas se ocultan o restringen en el builder según la selección del usuario.
      </p>
      <LayerExceptionsPanel
        collections={(rawCollections || []).map(mapCollection)}
        layers={(rawLayers || []).map(mapLayer)}
        exceptions={(rawExceptions || []).map(mapLayerException)}
      />
    </div>
  )
}
