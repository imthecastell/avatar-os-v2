import { createClient } from '@/lib/supabase/server'
import { mapAsset, mapLayer, mapCollection } from '@/lib/supabase/mappers'
import Studio from '@/components/admin/Studio'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawLayers }      = await supabase.from('layers').select('*').order('order_index')
  const { data: rawAssets }      = await supabase.from('assets').select('*').order('created_at', { ascending: false })

  return (
    <Studio
      collections={(rawCollections || []).map(mapCollection)}
      layers={(rawLayers || []).map(mapLayer)}
      assets={(rawAssets || []).map(mapAsset)}
    />
  )
}
