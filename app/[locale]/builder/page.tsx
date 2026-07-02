import { createClient } from '@/lib/supabase/server'
import { mapCollection, mapLayer, mapAsset, mapLayerException, mapLayerDefault } from '@/lib/supabase/mappers'
import BuilderClient from './BuilderClient'

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: rawCollections } = await supabase
    .from('collections')
    .select('*')
    .eq('active', true)
    .order('number')

  const collection = rawCollections?.[0] ? mapCollection(rawCollections[0]) : null

  let layers:     import('@/types').Layer[]          = []
  let assets:     import('@/types').Asset[]          = []
  let exceptions: import('@/types').LayerException[] = []
  let defaults:   import('@/types').LayerDefault[]   = []

  if (collection) {
    const [layersRes, assetsRes, exceptionsRes, defaultsRes] = await Promise.all([
      supabase.from('layers').select('*').eq('collection_id', collection.id).order('order_index'),
      supabase.from('assets').select('*').eq('collection_id', collection.id),
      supabase.from('layer_exceptions').select('*').eq('collection_id', collection.id),
      supabase.from('layer_defaults').select('*').eq('collection_id', collection.id),
    ])

    layers     = (layersRes.data || []).map(mapLayer)
    assets     = (assetsRes.data || []).map(mapAsset)
    exceptions = (exceptionsRes.data || []).map(mapLayerException)
    defaults   = (defaultsRes.data || []).map(mapLayerDefault)
  }

  return (
    <BuilderClient
      locale={locale}
      collection={collection}
      layers={layers}
      assets={assets}
      exceptions={exceptions}
      defaults={defaults}
    />
  )
}
