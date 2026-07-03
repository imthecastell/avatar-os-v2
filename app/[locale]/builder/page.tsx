import { createClient } from '@/lib/supabase/server'
import { mapCollection, mapLayer, mapAsset, mapLayerException, mapLayerDefault, mapSiteSettings } from '@/lib/supabase/mappers'
import type { SiteSettings } from '@/types'
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

  // Tabla nueva — puede no existir aún si la migración 008 no se aplicó todavía
  let settings: SiteSettings | null = null
  try {
    const { data: settingsRow } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
    if (settingsRow) settings = mapSiteSettings(settingsRow)
  } catch {
    settings = null
  }

  return (
    <BuilderClient
      locale={locale}
      collection={collection}
      layers={layers}
      assets={assets}
      exceptions={exceptions}
      defaults={defaults}
      settings={settings}
    />
  )
}
