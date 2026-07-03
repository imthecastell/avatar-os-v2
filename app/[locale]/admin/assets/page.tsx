import { createClient } from '@/lib/supabase/server'
import { mapAsset, mapLayer, mapCollection } from '@/lib/supabase/mappers'
import BatchUploader from '@/components/admin/BatchUploader'
import AssetPanel from '@/components/admin/AssetPanel'

export const dynamic = 'force-dynamic'

export default async function AdminAssetsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }     = await supabase.from('layers').select('*').order('order_index')
  const { data: rawAssets }     = await supabase.from('assets').select('*').order('created_at', { ascending: false })

  const collections = (rawCollections || []).map(mapCollection)
  const layers      = (rawLayers || []).map(mapLayer)
  const assets      = (rawAssets || []).map(mapAsset)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Assets</h1>
      </div>

      <BatchUploader collections={collections} layers={layers} />

      <div className="mt-8">
        <AssetPanel assets={assets} layers={layers} />
      </div>
    </div>
  )
}
