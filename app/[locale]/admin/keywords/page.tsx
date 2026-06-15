import { createClient } from '@/lib/supabase/server'
import { mapKeyword, mapCollection } from '@/lib/supabase/mappers'
import KeywordPanel from '@/components/admin/KeywordPanel'

export default async function AdminKeywordsPage() {
  const supabase = await createClient()

  const { data: rawCollections } = await supabase.from('collections').select('*').order('number')
  const { data: rawKeywords }    = await supabase.from('keywords').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-6">Keywords</h1>
      <KeywordPanel
        collections={(rawCollections || []).map(mapCollection)}
        keywords={(rawKeywords || []).map(mapKeyword)}
      />
    </div>
  )
}
