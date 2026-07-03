import { createClient } from '@/lib/supabase/server'
import { mapKeyword, mapCollection, mapLayer, mapColorUnlock, mapAsset } from '@/lib/supabase/mappers'
import KeywordPanel from '@/components/admin/KeywordPanel'

export const dynamic = 'force-dynamic'

export default async function AdminKeywordsPage() {
  const supabase = await createClient()

  const { data: rawCollections }  = await supabase.from('collections').select('*').order('number')
  const { data: rawKeywords }     = await supabase.from('keywords').select('*').order('created_at', { ascending: false })
  const { data: rawLayers }       = await supabase.from('layers').select('*').order('order_index')
  const { data: rawColorUnlocks } = await supabase.from('color_unlocks').select('*')
  const { data: rawAssets }       = await supabase.from('assets').select('*')

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <h1 className="text-lg font-semibold text-white mb-6">Keywords</h1>
      <KeywordPanel
        collections={(rawCollections || []).map(mapCollection)}
        keywords={(rawKeywords || []).map(mapKeyword)}
        layers={(rawLayers || []).map(mapLayer)}
        colorUnlocks={(rawColorUnlocks || []).map(mapColorUnlock)}
        assets={(rawAssets || []).map(mapAsset)}
      />
    </div>
  )
}
