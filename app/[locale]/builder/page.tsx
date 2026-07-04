import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mapCollection, mapLayer, mapAsset, mapLayerException, mapLayerDefault, mapSiteSettings, mapColorUnlock } from '@/lib/supabase/mappers'
import type { SiteSettings, ColorUnlock } from '@/types'
import BuilderClient from './BuilderClient'

// Sin esto, Next.js cachea las consultas a Supabase por debajo y el builder
// público puede quedar mostrando datos viejos tras cambios en el admin
// (capas, assets, publicar) hasta que expire un caché invisible.
export const dynamic = 'force-dynamic'

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

  let layers:      import('@/types').Layer[]          = []
  let assets:      import('@/types').Asset[]          = []
  let exceptions:  import('@/types').LayerException[] = []
  let defaults:    import('@/types').LayerDefault[]   = []
  let colorUnlocks: ColorUnlock[]                     = []
  // Solo id + isMaster — nunca la palabra clave real ni su label, para no
  // filtrar los códigos secretos en el HTML/props del cliente.
  let masterKeywordIds: string[] = []

  if (collection) {
    // Cliente admin (bypasea RLS): la tabla `assets` tiene una política que
    // oculta filas con keyword_id a la clave anónima — por diseño, para que
    // nadie liste el contenido secreto consultando la API directo. Pero eso
    // significa que la clave anónima NUNCA recibía esos assets, así que el
    // desbloqueo por palabra clave (que filtra en el cliente con JS) no tenía
    // nada que revelar. Se trae todo con admin y el filtrado de qué se ve
    // sigue pasando en el navegador según `unlockedKeywords`.
    const adminSupabase = createAdminClient()
    const [layersRes, assetsRes, exceptionsRes, defaultsRes, colorUnlocksRes, keywordsRes] = await Promise.all([
      adminSupabase.from('layers').select('*').eq('collection_id', collection.id).order('order_index'),
      adminSupabase.from('assets').select('*').eq('collection_id', collection.id),
      adminSupabase.from('layer_exceptions').select('*').eq('collection_id', collection.id),
      adminSupabase.from('layer_defaults').select('*').eq('collection_id', collection.id),
      adminSupabase.from('color_unlocks').select('*').eq('collection_id', collection.id),
      adminSupabase.from('keywords').select('id, is_master').eq('collection_id', collection.id).eq('is_master', true),
    ])

    layers        = (layersRes.data || []).map(mapLayer)
    assets        = (assetsRes.data || []).map(mapAsset)
    exceptions    = (exceptionsRes.data || []).map(mapLayerException)
    defaults      = (defaultsRes.data || []).map(mapLayerDefault)
    colorUnlocks  = (colorUnlocksRes.data || []).map(mapColorUnlock)
    masterKeywordIds = (keywordsRes.data || []).map((r: { id: string }) => r.id)
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
      colorUnlocks={colorUnlocks}
      masterKeywordIds={masterKeywordIds}
    />
  )
}
