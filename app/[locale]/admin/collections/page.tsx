import { createClient } from '@/lib/supabase/server'
import { mapCollection } from '@/lib/supabase/mappers'
import CollectionsPanel from '@/components/admin/CollectionsPanel'

export const dynamic = 'force-dynamic'

export default async function AdminCollectionsPage() {
  const supabase = await createClient()
  const { data: raw } = await supabase.from('collections').select('*').order('number')

  return (
    <div className="overflow-y-auto h-full px-6 py-8">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-white">Colecciones</h1>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Cada colección es un set de assets. Usa "⬡ Capas" para generar las 10 capas estándar de golpe.
          </p>
        </div>
        <CollectionsPanel collections={(raw || []).map(mapCollection)} />
      </div>
    </div>
  )
}
