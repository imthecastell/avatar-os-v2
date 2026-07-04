import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Reinicia todos los assets de una capa a "heredar el default de la capa":
// borra sus overrides individuales (ajuste de posición, color desactivado,
// reglas de color propias) para que vuelvan a seguir la regla de la capa.
export async function POST(request: NextRequest) {
  const { layerId } = await request.json()
  if (!layerId) return NextResponse.json({ error: 'Missing layerId' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: layer, error: layerErr } = await supabase
    .from('layers')
    .select('collection_id, layer_key')
    .eq('id', layerId)
    .single()
  if (layerErr || !layer) return NextResponse.json({ error: layerErr?.message ?? 'Layer not found' }, { status: 404 })

  const { data: layerAssets, error: assetsErr } = await supabase
    .from('assets')
    .select('id')
    .eq('collection_id', layer.collection_id)
    .eq('layer_key', layer.layer_key)
  if (assetsErr) return NextResponse.json({ error: assetsErr.message }, { status: 500 })

  const ids = (layerAssets || []).map((a: { id: string }) => a.id)
  if (ids.length > 0) {
    const { error: updErr } = await supabase
      .from('assets')
      .update({ allow_transform: null, color_disabled: false })
      .in('id', ids)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    const { error: delErr } = await supabase
      .from('color_unlocks')
      .delete()
      .in('target_asset_id', ids)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: ids.length })
}
