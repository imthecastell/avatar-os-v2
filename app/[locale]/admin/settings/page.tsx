import { createClient } from '@/lib/supabase/server'
import { mapSiteSettings } from '@/lib/supabase/mappers'
import SettingsPanel from '@/components/admin/SettingsPanel'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  let settings = null
  try {
    const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
    if (data) settings = mapSiteSettings(data)
  } catch {
    settings = null
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 overflow-y-auto h-full w-full">
      <h1 className="text-lg font-semibold text-white mb-1">Pantalla de bienvenida</h1>
      <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Contenido que ven los usuarios antes de entrar al builder público. El avatar se guarda desde Studio con el botón &quot;📸 Usar como avatar de bienvenida&quot;.
      </p>
      <SettingsPanel initialSettings={settings} />
    </div>
  )
}
