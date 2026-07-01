import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const collectionId = searchParams.get('collectionId')
  const layerKey = searchParams.get('layerKey')

  const supabase = await createClient()

  let query = supabase.from('assets').select('*')

  if (collectionId) query = query.eq('collection_id', collectionId)
  if (layerKey) query = query.eq('layer_key', layerKey)

  // Only public assets (no keyword required)
  query = query.is('keyword_id', null)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await supabase
    .from('assets')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const singleId = searchParams.get('id')

  // Single delete via query param (legacy)
  if (singleId) {
    const { error } = await supabase.from('assets').delete().eq('id', singleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Bulk delete via JSON body: { ids: string[] }
  const body = await request.json().catch(() => ({}))
  const ids: string[] = body.ids ?? []
  if (!ids.length) return NextResponse.json({ error: 'Missing id or ids' }, { status: 400 })

  const { error } = await supabase.from('assets').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: ids.length })
}
